# NEST Registry Contract (NEAR / Rust)

Status: **CI-verified source; not deployed yet**. GitHub Actions [run 41438795901](https://github.com/Arinzaay007/N.E.S.T/actions/runs/41438795901) passed the Rust unit tests and `cargo-near` WASM build at commit `e40c034cba6a655a9f5299c52ec3070e353fe487`, uploading the `nest-registry-wasm` artifact. That compile proof is separate from deployment: no contract address, testnet transaction, mainnet transaction, or on-chain volume is claimed until human-local deployment evidence exists.

## What it does

- Keeps the canonical NEST mapping: `handle -> NEAR account ID + display name`.
- Enforces one permanent v1 handle per account and the same 3–20 character rules as the app.
- Rejects reserved names such as `wallet`, `support`, `near`, and `nest`.
- Receives USDC through NEP-141 `ft_on_transfer` **only** when the predecessor is the configured USDC contract.
- Resolves the handle in the transfer message, forwards the exact recipient amount, forwards the tiny sponsor gas reimbursement, and emits a structured `payment_settled` event with memo/reference/batch fields.
- Returns the full amount as “unused” for an unknown handle or malformed payment message, so the token contract can refund the sender instead of trapping value.

## Payment message

Call `ft_transfer_call` on the configured USDC token, with this contract as the receiver and a JSON `msg`:

```json
{
  "handle": "mystore",
  "recipient_amount": "10000000",
  "memo": "Website design deposit",
  "reference": "INV-1024",
  "batch_id": null
}
```

Token amounts are raw smallest units. For a 6-decimal USDC token, `10000000` is $10.00. The transferred total must cover `recipient_amount + network_fee`; any excess is returned as unused after the recipient leg succeeds.

## Intended activation sequence

1. The sponsor funds the minimum NEAR needed for the user's implicit account/access key.
2. The sponsor (or user) performs USDC `storage_deposit` registration for the recipient account.
3. The user signs a NEP-366 delegate action for `register_handle`; the relayer submits it without being able to change the bound method/args.
4. The indexer observes `handle_registered`, and the app resolves the handle from chain state.
5. Senders call USDC `ft_transfer_call` to this contract; the indexer observes `payment_settled`.

## Build and test

Install Rust, the NEAR WASM target, and `cargo-near`, then run:

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked cargo-near
cargo test
cargo near build non-reproducible-wasm --no-abi
```

Expected WASM output:

```text
target/near/nest_registry.wasm
```

The repository root also exposes `npm run contract:test` and `npm run contract:build` wrappers for these commands.

## Deployment inputs still required

- Human-owned NEAR owner account.
- Dedicated low-balance sponsor/relayer account.
- Official USDC token contract ID for the chosen network.
- A reviewed raw-unit `network_fee` value.
- Testnet deployment and end-to-end delegate/USDC tests before any mainnet spend.

Do not deploy, sign, or spend without explicit human approval.
