# Judge Guide

## Fastest evaluation path (about 3 minutes)

### 1. Start and land

```bash
npm install
npm run dev
```

Open `/`.

**See:** dollar-first positioning, the 13 target routes collapsing into one NEST balance, live prototype counters, and an explicit route-verification promise.

### 2. Inspect a merchant before signing in

Open `/@mystore`.

**Do:** switch from “Pay with NEST” to “Pay from another chain,” choose Base, request an exact amount.

**See:** recipient amount remains exact, NEST fee is $0.00, and the quote is clearly labelled **Simulated demo** in default mode. Settle the simulation and copy the receipt.

### 3. Create a wallet

Open `/claim`, enter any email, use the demo OTP shown on screen, and claim a handle.

**See:** handle availability is checked as you type. Before creation, the custody disclosure says that NEST can decrypt server-encrypted keys.

### 4. Fund and pay by name

In `/wallet`, add $100 demo USDC. Then pay `@alice` from `/send`.

**See:** Alice resolves to a display name before the send button activates. Try `@doesnotexist`: the form remains blocked with “User not found.”

### 5. Run payroll

Open `/send` → **Batch payroll**.

**See:** the pasted list resolves `@sulaimon`, `@chidi`, and `@alice`; subtotal and one 1¢ batch network amount are separated. Break one row and observe a line-specific hard block.

### 6. Use merchant tools

In `/wallet` → **Receive**, inspect the personal/merchant QR.

In **Invoices**, create a $25 invoice and open the generated `/pay/...` URL in a private window.

**See:** QR, fixed amount, reference, unpaid state and both payment methods. Pay it and return to the wallet: status, activity and CSV data have changed.

### 7. Read the trust boundaries

Open `/security`, `/stats`, and `/docs`.

**See:** simulated data is not described as mainnet volume, route targets are not called live without proof, and the email-wallet custody caveat is stated in plain English.

## Seeded shortcuts

- Merchant: `store@demo.nest` → `@mystore`
- Payer/team lead: `arinzaay@demo.nest` → `@arinzaay`
- Invoice: `/pay/link_seed_invoice`

Use the on-screen OTP while `NEST_DEMO_OTP` is enabled.

## What to inspect in code

- `src/lib/money.ts`, `handle.ts`, `batch.ts`, `quotes.ts` — pure, testable product rules.
- `src/lib/crypto.ts` — ed25519 implicit accounts, AES-256-GCM key storage, signed session/claim tokens, hashed OTPs.
- `src/lib/oneClick.ts` — live token discovery and `EXACT_OUTPUT` request construction behind explicit flags.
- `src/lib/db.ts` — the intentionally replaceable prototype ledger boundary.
- `contracts/nest-registry/src/lib.rs` — one-handle-per-account registry plus USDC `ft_on_transfer` routing/refund behavior.

## Honest limitations in Bit 1

- Local JSON ledger, not Postgres/indexer-backed production settlement.
- Simulated cross-chain settlement by default.
- Rust contract source is not compiled/deployed in the current sandbox.
- Key export, session/device revocation and step-up re-auth are specified production gates, not finished features.
- No mainnet transaction has been signed or spent.
