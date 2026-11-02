# Roadmap and Verification Gates

NEST is being built **bit by bit**. Each gate must pass before the next claim is made publicly.

## Bit 1 — Runnable product core

- [x] Email OTP sign-in and encrypted wallet creation
- [x] Permanent handle validation/claim
- [x] Public `@handle` profiles and QR codes
- [x] One-to-one payments with unknown-handle hard block
- [x] Batch payroll parsing, resolution, grouping and one batch network amount
- [x] Merchant-lite invoices, paid state and CSV export
- [x] Exact-output simulated quote/settle flow with explicit warnings
- [x] Guarded 1Click adapter boundary
- [x] NEAR registry/payment-router Rust source
- [x] Unit tests for money, handles, batches and quote math
- [ ] User acceptance pass in the live preview

## Bit 2 — Real-integration scaffolding

- [x] Read-only NEAR RPC library and `/api/near/status` readiness endpoint
- [x] Registry/USDC account, balance and storage checks without signing
- [x] Dry-only 1Click verifier for live assets plus dry exact-output quotes
- [x] GitHub Actions runs Cargo unit tests, builds the registry WASM with `cargo-near`, and uploads the artifact
- [x] Bit 2 pushed and contract CI passed ([run 41438795901](https://github.com/Arinzaay007/N.E.S.T/actions/runs/41438795901))
- [ ] Human provides public testnet and dry-quote verification account IDs

## Gate A — NEAR toolchain and testnet registry

- [x] Run `cargo test` and build the registry WASM in GitHub Actions.
- [ ] Install Rust, `wasm32-unknown-unknown`, `cargo-near`, and NEAR CLI in the human's local signing environment.
- [ ] Deploy only to NEAR testnet with a human-confirmed deployer account.
- [ ] Verify handle registration, duplicate rejection and reverse resolution.
- [ ] Verify validated USDC-style `ft_transfer_call` routing, sponsor slice, unknown-handle refund and emitted events.
- [ ] Record contract ID and sample testnet transaction links.

## Gate B — Delegate, sponsor and signer proof

- [ ] Prove sponsor-funded activation, access-key setup and USDC storage registration.
- [ ] Prove a NEP-366 signed delegate for `register_handle` through a test relayer.
- [ ] Prove delegate payment submission without exposing plaintext keys through ordinary APIs/logs.
- [ ] Add sponsor balance caps, transaction quotas and refill procedure.
- [ ] Add key export with step-up re-auth, session/device revocation and stronger rate limits.

## Gate C — Production data plane

- [ ] Replace `.data` with Postgres transactions and idempotency keys.
- [ ] Add a NEAR event indexer for handles, USDC balances, payments and invoice reconciliation.
- [ ] Isolate the signer/vault from the public web process.
- [ ] Add observable quote/deposit jobs and failure recovery.

## Gate D — Route-by-route cross-chain proof

For every target route:

- [ ] Exact asset found in the live 1Click token list.
- [ ] Dry exact-output quote succeeds.
- [ ] Deposit format/memo/refund path validated.
- [ ] Human-approved capped tiny settlement succeeds.
- [ ] Source and NEAR explorer receipts recorded.

Base USDC is first. No route is advertised as live before its row is complete.

## Gate E — Submission readiness

- [ ] Human confirms repository visibility change.
- [ ] Human controls the Base proof wallet and confirms any spend immediately before execution.
- [ ] Human publishes the demo post.
- [ ] Human reviews exact submission fields and confirms the one-time payload.
- [ ] Final content/commit-message scans pass.
- [ ] Fresh clone passes install, tests, typecheck and build.

No push, publication, deployment, signature, spend, post or submission happens without explicit human confirmation at that step.
