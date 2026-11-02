use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::LookupMap;
use near_sdk::{
    env, ext_contract, near_bindgen, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    PromiseError, PromiseOrValue,
};

const TGAS_FOR_FT_TRANSFER: u32 = 20;
const TGAS_FOR_CALLBACK: u32 = 15;
const RESERVED_HANDLES: [&str; 16] = [
    "admin", "api", "claim", "docs", "help", "login", "nest", "near", "official", "pay",
    "security", "send", "sponsor", "stats", "support", "wallet",
];

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Handles,
    Accounts,
}

#[derive(Clone, BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct HandleRecord {
    account_id: AccountId,
    display_name: String,
    created_at_ns: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct HandleView {
    handle: String,
    account_id: AccountId,
    display_name: String,
    created_at_ns: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ConfigView {
    owner_id: AccountId,
    sponsor_id: AccountId,
    usdc_id: AccountId,
    network_fee: U128,
    handles: u64,
    payments: u64,
}

/// Message sent with `ft_transfer_call` on the configured USDC contract.
///
/// Example:
/// `{"handle":"mystore","recipient_amount":"10000000","reference":"INV-1024"}`
/// The token amount attached to the call must be recipient_amount + network_fee
/// (plus any intentionally refundable excess, which the callback returns).
#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct PaymentMessage {
    handle: String,
    recipient_amount: Option<U128>,
    memo: Option<String>,
    reference: Option<String>,
    batch_id: Option<String>,
}

#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[borsh(crate = "near_sdk::borsh")]
pub struct Contract {
    owner_id: AccountId,
    sponsor_id: AccountId,
    usdc_id: AccountId,
    network_fee: u128,
    handles: LookupMap<String, HandleRecord>,
    accounts: LookupMap<AccountId, String>,
    handle_count: u64,
    payment_count: u64,
}

fn validate_handle(handle: &str) -> bool {
    let bytes = handle.as_bytes();
    (3..=20).contains(&bytes.len())
        && bytes.first().is_some_and(|b| b.is_ascii_lowercase())
        && !bytes.last().is_some_and(|b| *b == b'_')
        && bytes
            .iter()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'_')
        && !RESERVED_HANDLES.contains(&handle)
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(
        owner_id: AccountId,
        sponsor_id: AccountId,
        usdc_id: AccountId,
        network_fee: U128,
    ) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            owner_id,
            sponsor_id,
            usdc_id,
            network_fee: network_fee.0,
            handles: LookupMap::new(StorageKey::Handles),
            accounts: LookupMap::new(StorageKey::Accounts),
            handle_count: 0,
            payment_count: 0,
        }
    }

    /// Registers one permanent v1 handle for the predecessor account.
    ///
    /// In production this is the call authorized by the user's signed delegate
    /// action after sponsor-funded account activation and USDC storage
    /// registration. The registry itself never sees an email address.
    pub fn register_handle(&mut self, handle: String, display_name: String) -> HandleView {
        assert!(validate_handle(&handle), "Invalid handle");
        assert!(display_name.trim().len() <= 60, "Display name is too long");
        let account_id = env::predecessor_account_id();
        assert!(!self.handles.contains_key(&handle), "Handle already taken");
        assert!(
            !self.accounts.contains_key(&account_id),
            "Account already has a handle"
        );

        let record = HandleRecord {
            account_id: account_id.clone(),
            display_name: display_name.trim().to_string(),
            created_at_ns: env::block_timestamp(),
        };
        self.handles.insert(handle.clone(), record.clone());
        self.accounts.insert(account_id.clone(), handle.clone());
        self.handle_count += 1;

        env::log_str(
            &serde_json::json!({
                "standard": "nest",
                "version": "1.0.0",
                "event": "handle_registered",
                "data": [{
                    "handle": handle,
                    "account_id": account_id,
                    "display_name": record.display_name
                }]
            })
            .to_string(),
        );

        HandleView {
            handle,
            account_id: record.account_id,
            display_name: record.display_name,
            created_at_ns: record.created_at_ns,
        }
    }

    pub fn resolve_handle(&self, handle: String) -> Option<HandleView> {
        self.handles.get(&handle).map(|record| HandleView {
            handle,
            account_id: record.account_id.clone(),
            display_name: record.display_name.clone(),
            created_at_ns: record.created_at_ns,
        })
    }

    pub fn handle_of(&self, account_id: AccountId) -> Option<String> {
        self.accounts.get(&account_id).cloned()
    }

    pub fn config(&self) -> ConfigView {
        ConfigView {
            owner_id: self.owner_id.clone(),
            sponsor_id: self.sponsor_id.clone(),
            usdc_id: self.usdc_id.clone(),
            network_fee: U128(self.network_fee),
            handles: self.handle_count,
            payments: self.payment_count,
        }
    }

    pub fn set_network_fee(&mut self, network_fee: U128) {
        self.assert_owner();
        self.network_fee = network_fee.0;
    }

    pub fn set_sponsor(&mut self, sponsor_id: AccountId) {
        self.assert_owner();
        self.sponsor_id = sponsor_id;
    }

    /// NEP-141 receiver hook. Only the configured USDC contract may call it.
    ///
    /// Returning the full amount for an unknown handle or malformed message is
    /// intentional: the token contract refunds unused tokens to the sender,
    /// so an unregistered name cannot trap funds in this contract.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        assert_eq!(
            env::predecessor_account_id(),
            self.usdc_id,
            "Only the configured USDC contract can route payments"
        );

        let payment: PaymentMessage = match serde_json::from_str(&msg) {
            Ok(payment) => payment,
            Err(_) => return PromiseOrValue::Value(amount),
        };
        let Some(record) = self.handles.get(&payment.handle) else {
            return PromiseOrValue::Value(amount);
        };

        let total = amount.0;
        let fee = self.network_fee;
        if total <= fee {
            return PromiseOrValue::Value(amount);
        }
        let recipient_amount = payment
            .recipient_amount
            .map(|value| value.0)
            .unwrap_or(total - fee);
        if recipient_amount == 0 || recipient_amount.checked_add(fee).is_none_or(|v| v > total) {
            return PromiseOrValue::Value(amount);
        }

        let token_memo = payment
            .reference
            .clone()
            .or_else(|| payment.memo.clone())
            .map(|memo| format!("NEST @{} {}", payment.handle, memo));

        ext_ft::ext(self.usdc_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(Gas::from_tgas(TGAS_FOR_FT_TRANSFER.into()))
            .ft_transfer(
                record.account_id.clone(),
                U128(recipient_amount),
                token_memo,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(TGAS_FOR_CALLBACK.into()))
                    .on_recipient_paid(
                        sender_id,
                        payment.handle,
                        record.account_id.clone(),
                        amount,
                        U128(recipient_amount),
                        U128(fee),
                        payment.memo,
                        payment.reference,
                        payment.batch_id,
                    ),
            )
            .into()
    }

    #[private]
    pub fn on_recipient_paid(
        &mut self,
        sender_id: AccountId,
        recipient_handle: String,
        recipient_id: AccountId,
        total_amount: U128,
        recipient_amount: U128,
        sponsor_amount: U128,
        memo: Option<String>,
        reference: Option<String>,
        batch_id: Option<String>,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> U128 {
        if result.is_err() {
            // The recipient leg did not execute, so ask the token contract to
            // refund the complete routed amount to the original sender.
            return total_amount;
        }

        self.payment_count += 1;
        if sponsor_amount.0 > 0 {
            let _ = ext_ft::ext(self.usdc_id.clone())
                .with_attached_deposit(NearToken::from_yoctonear(1))
                .with_static_gas(Gas::from_tgas(TGAS_FOR_FT_TRANSFER.into()))
                .ft_transfer(
                    self.sponsor_id.clone(),
                    sponsor_amount,
                    Some("NEST sponsor gas reimbursement".to_string()),
                );
        }

        env::log_str(
            &serde_json::json!({
                "standard": "nest",
                "version": "1.0.0",
                "event": "payment_settled",
                "data": [{
                    "payment_id": self.payment_count,
                    "sender_id": sender_id,
                    "recipient_handle": recipient_handle,
                    "recipient_id": recipient_id,
                    "recipient_amount": recipient_amount.0.to_string(),
                    "sponsor_amount": sponsor_amount.0.to_string(),
                    "memo": memo,
                    "reference": reference,
                    "batch_id": batch_id
                }]
            })
            .to_string(),
        );

        // Refund only an intentional excess above recipient + sponsor fee.
        U128(total_amount.0 - recipient_amount.0 - sponsor_amount.0)
    }

    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the contract owner can call this method"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn setup(predecessor: AccountId) {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        testing_env!(builder.build());
    }

    #[test]
    fn validates_handle_rules() {
        assert!(validate_handle("alice_1"));
        assert!(!validate_handle("ab"));
        assert!(!validate_handle("bad-name"));
        assert!(!validate_handle("_alice"));
        assert!(!validate_handle("alice_"));
        assert!(!validate_handle("wallet"));
    }

    #[test]
    fn registers_and_resolves_one_handle_per_account() {
        setup(accounts(1));
        let mut contract = Contract::new(accounts(0), accounts(3), accounts(4), U128(10_000));
        let view = contract.register_handle("alice".into(), "Alice".into());
        assert_eq!(view.account_id, accounts(1));
        assert_eq!(contract.handle_of(accounts(1)), Some("alice".into()));
        assert_eq!(
            contract.resolve_handle("alice".into()).unwrap().display_name,
            "Alice"
        );
    }

    #[test]
    #[should_panic(expected = "Handle already taken")]
    fn rejects_duplicate_handle() {
        setup(accounts(1));
        let mut contract = Contract::new(accounts(0), accounts(3), accounts(4), U128(10_000));
        contract.register_handle("alice".into(), "Alice".into());
        setup(accounts(2));
        contract.register_handle("alice".into(), "Other Alice".into());
    }
}
