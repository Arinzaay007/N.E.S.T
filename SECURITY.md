# Security

## Bit 1 warning

This repository currently contains a judge-runnable prototype with a local ledger and simulated cross-chain settlement by default. **Do not use it for real funds and do not deposit to simulated addresses.**

## Custody disclosure

N.E.S.T wallet keys are encrypted on NEST servers so the same email restores the same wallet. **NEST can decrypt them.** This is custodial-adjacent, not non-custodial.

Consequences:

- A compromised email inbox may compromise wallet recovery.
- Simultaneous compromise of encrypted key storage and the encryption secret may expose keys.
- Losing email access without exported recovery material may make funds unrecoverable.

## Implemented controls

- AES-256-GCM encryption for stored private keys.
- Real ed25519 key generation; public data omits private keys and emails.
- Hashed, expiring OTP records with an attempt limit.
- Signed HTTP-only session cookies and short-lived claim tokens.
- Server-side handle, amount, invoice-owner, invoice-amount and paid-state validation.
- Unknown handles hard-block before payment creation.
- Live quotes are separated from simulated settlement.
- Contract design accepts routed funds only from the configured USDC predecessor and refunds unknown-handle payment messages as unused token amount.

## Required before real custody

- Recovery/key export behind fresh re-authentication.
- Device/session inventory and revocation.
- Step-up authentication for sensitive actions.
- KMS/HSM-backed envelope encryption and an isolated signer service.
- Rate limiting, audit logging, monitoring and incident response.
- Contract audit/review, testnet integration proof and sponsor-wallet controls.

## Reporting

Do not open a public issue containing secrets, private keys, OTPs or a live exploit. Contact the project maintainer privately through the repository owner's established channel and include only the minimum reproduction details needed.
