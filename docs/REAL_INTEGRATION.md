# Bit 2 — Making NEST Real

This runbook turns the Bit 1 prototype into verifiable NEAR and cross-chain integrations **without skipping safety gates**. Nothing in this document authorizes a signature, storage deposit, deployment, or spend by itself. The human account owner confirms each value-moving step immediately before it happens.

## What Bit 2 adds in code

- `src/lib/near.ts` — read-only NEAR JSON-RPC client for account views, registry `config`, `resolve_handle`, `handle_of`, USDC `ft_balance_of`, and `storage_balance_of`.
- `GET /api/near/status` — public read-only readiness endpoint. Example: `/api/near/status?accountId=alice.testnet&handle=alice`.
- `scripts/near-preflight.mjs` — CLI version of the same public checks; no keys accepted.
- `scripts/verify-1click-routes.mjs` — dry-only route verifier. It hard-codes `dry: true`, checks exact live 1Click assets, then submits dry `EXACT_OUTPUT` quotes.
- Updated 1Click adapter — shared live-token lookup, exact-output request builder, dry verification helper, Partner API-key/JWT header support, and status polling with optional deposit memo.
- `.github/workflows/contract-ci.yml` — after an approved push, GitHub Actions can run Rust unit tests and build the registry WASM in an environment with crates access.

## Gate A — Compile the registry

Locally, where Rust is installed:

```bash
rustup target add wasm32-unknown-unknown
npm run contract:test
npm run contract:build
```

Expected artifact:

```text
contracts/nest-registry/target/wasm32-unknown-unknown/release/nest_registry.wasm
```

The current Arena sandbox has no `cargo`, `rustc`, or `near` binary and cannot download the Rust toolchain/crates. Therefore local success in this sandbox is **not** contract-compile proof. The GitHub workflow is the next proof point after the human approves pushing Bit 2.

## Gate B — Testnet deployment (human signs locally)

Human-owned prerequisites:

1. A NEAR **testnet deployer** account funded from a testnet faucet.
2. A chosen testnet contract account/subaccount for the registry.
3. A testnet sponsor account (can be separate from deployer).
4. A testnet NEP-141 token contract to stand in for USDC during routing tests.
5. Two test user accounts for handle/payment tests.

Never paste seed phrases, private keys, passwords, OTPs, or API secrets into chat or the repository. Share only public account IDs and transaction hashes.

Illustrative NEAR CLI RS flow — verify syntax with the installed CLI's `--help` before signing:

```bash
near contract deploy "$REGISTRY_ID" use-file \
  contracts/nest-registry/target/wasm32-unknown-unknown/release/nest_registry.wasm \
  with-init-call new json-args \
  "{\"owner_id\":\"$OWNER_ID\",\"sponsor_id\":\"$SPONSOR_ID\",\"usdc_id\":\"$TEST_TOKEN_ID\",\"network_fee\":\"10000\"}" \
  prepaid-gas '100 TeraGas' attached-deposit '0 NEAR' \
  sign-as "$DEPLOYER_ID" network-config testnet sign-with-keychain send
```

Read-only checks after deployment:

```bash
NEAR_NETWORK_ID=testnet \
NEAR_REGISTRY_CONTRACT_ID="$REGISTRY_ID" \
NEAR_USDC_CONTRACT_ID="$TEST_TOKEN_ID" \
npm run near:preflight -- --account="$USER_A_ID" --handle=alice
```

Required testnet evidence before mainnet discussion:

- Contract ID and deploy transaction.
- `register_handle` transaction for a test handle.
- `resolve_handle` result matching the intended account.
- Duplicate handle and second-handle attempts rejected.
- Token `storage_deposit` completed for payer, recipient, sponsor, and registry as required by the chosen test token.
- `ft_transfer_call` to the registry forwards the exact recipient amount and sponsor slice.
- Unknown-handle `ft_transfer_call` returns/refunds rather than trapping funds.
- Payment event contains handle, recipient, amounts, memo/reference, and batch ID where supplied.

## Gate C — App chain-read configuration

After a testnet registry exists, configure the web app with public contract IDs:

```bash
NEAR_NETWORK_ID=testnet
NEAR_REGISTRY_CONTRACT_ID=<registry.testnet>
NEAR_USDC_CONTRACT_ID=<test-token.testnet>
```

Then check:

```text
/api/near/status?accountId=<user.testnet>&handle=<handle>
```

This only proves the app can read chain state. It does **not** yet replace the prototype ledger for balances or payment execution. That requires the signer/delegate service, transaction submission, receipt verification, idempotency, and an indexer.

## Gate D — Verify every cross-chain route dry

The verifier cannot create a live spending quote. It always sends `dry: true`.

```bash
NEST_VERIFY_RECIPIENT_NEAR=<public-near-account> \
NEST_VERIFY_REFUND_EVM=<public-evm-refund-address> \
npm run routes:verify -- --route=base --amount-cents=100
```

For all target routes, add public refund addresses for Solana/TON where relevant:

```bash
NEST_VERIFY_RECIPIENT_NEAR=<public-near-account> \
NEST_VERIFY_REFUND_EVM=<public-evm-refund-address> \
NEST_VERIFY_REFUND_SOLANA=<public-solana-refund-address> \
NEST_VERIFY_REFUND_TON=<public-ton-refund-address> \
npm run routes:verify -- --amount-cents=100 --out=route-verification.json
```

A route may be called quote-verified only when the report shows:

- exact origin `assetId`, blockchain, symbol and decimals;
- `status: "DRY_QUOTE_OK"`;
- an input amount for the exact requested NEAR USDC output.

If the token is absent or the dry quote fails, the route stays a labelled target. Do not work around that with a simulated “live” label.

## Gate E — Capped mainnet proof (separate final confirmation)

Only after Gates A–D have evidence for the chosen path:

1. Human confirms the exact public NEAR recipient and Base sender/refund address.
2. Confirm the NEAR recipient's USDC storage/balance state with `near:preflight` on mainnet.
3. Generate one **live** exact-output quote for a tiny fixed output (recommended first proof: $1.00).
4. Human reviews the exact source amount, origin asset, deposit address, deposit memo if any, recipient, refund address, deadline, and expected NEAR USDC output.
5. Human sends from their own wallet. The assistant never receives or uses the private key/seed.
6. Poll 1Click status until `SUCCESS`, `REFUNDED`, or `FAILED`.
7. Verify the NEAR USDC balance delta and record source/destination explorer links.
8. Only then update public route copy from “target” to “live-proven” for that asset/route.

The mainnet contract deployment is a separate, later decision after testnet evidence and review. A 1Click proof to a NEAR account does not by itself prove the NEST registry/sponsor payment path.

## Still not production-real after Bit 2 scaffolding

- Encrypted email-wallet signing is not wired to NEAR transactions.
- NEP-366 delegate creation/relaying is not implemented in the app.
- Handle claims and balances still use the prototype ledger until transaction submission + indexing replace it.
- Key export, session/device revocation, step-up authentication, KMS/HSM signer isolation, Postgres, and production rate limits remain required before serious custody.
