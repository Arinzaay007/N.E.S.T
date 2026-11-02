# Architecture

## Design goal

Hide chain and address complexity behind one human object:

```text
@handle + USD amount + optional memo/reference
```

All three v1 jobs use it:

1. pay one person;
2. pay a fixed merchant/invoice request;
3. pay many people in one validated batch.

## Current Bit 1 components

### Web app

Next.js App Router with server-rendered public pages and focused client components for forms and wallet state.

- `/` explains the product and shows live local-ledger counters.
- `/claim` performs email OTP and handle claim.
- `/send` handles one-to-one payments and batch payroll.
- `/@handle` is the public payable identity.
- `/pay/[id]` is a fixed invoice.
- `/wallet` contains balance, receive QR, invoices, activity, batches and security details.
- `/security`, `/stats`, `/docs` make trust and implementation status inspectable.

### Pure domain libraries

| Module | Responsibility |
|---|---|
| `money.ts` | Integer-cent parsing/formatting and network-fee constant |
| `handle.ts` | Handle normalization, syntax and reserved names |
| `batch.ts` | Payroll text parsing with per-line errors |
| `quotes.ts` | Target route catalogue and exact-output simulation math |
| `errors.ts` | Typed API errors |

These modules are covered by Vitest and do not depend on HTTP, cookies or persistence.

### Identity and encrypted wallets

1. The user enters an email.
2. The server stores only an HMAC hash of a six-digit OTP with expiry and attempt count.
3. Successful verification either restores an existing account or issues a short-lived signed claim token.
4. Claim generates a real ed25519 keypair and derives the NEAR implicit account ID from the public key.
5. The private key is encrypted with AES-256-GCM before it reaches the prototype store.
6. A signed HTTP-only cookie identifies the session.

**Custody boundary:** the service holds the encryption capability and can decrypt keys. This is custodial-adjacent and is disclosed as such.

### Prototype ledger boundary

`src/lib/db.ts` owns users, invoices, transfers, quotes, OTP records and sponsor counters. It persists to ignored `.data/nest-db.json` so the complete demo runs without infrastructure.

The API layer depends on functions such as `createPayments`, `createPaymentLink`, `saveQuote`, `settleQuote`, and `getDashboard`, not on ledger JSON directly. That is the migration seam for:

- Postgres for identity/session/invoice metadata;
- an isolated signer/vault for encrypted keys;
- NEAR RPC/indexer-derived balances and receipts;
- quote/deposit state persisted independently from the web process.

### Internal payment execution

`createPayments` validates the entire request before mutating balances:

- sender exists;
- recipient handle exists;
- sender cannot pay self;
- amount is a positive safe integer within product bounds;
- invoice owner, full amount and unpaid state match when an invoice is attached;
- sender covers subtotal plus exactly one network amount.

Only then does it allocate one batch ID (for multi-payment requests), update balances, accrue the sponsor amount, create receipts and mark an invoice paid.

### Cross-chain adapter

`src/lib/oneClick.ts` has two modes:

- **SIMULATED** (default): deterministic demo deposit address and route-specific exact-output estimate. The UI labels it and warns not to deposit real funds.
- **ONECLICK** (explicitly enabled + refund address): fetches live tokens, finds the exact origin asset and NEAR USDC, builds an `EXACT_OUTPUT` quote, and returns the quote-specific deposit address.

Simulated quotes may settle through the demo-only endpoint. Live quotes cannot: they settle only after the status endpoint observes `SUCCESS`.

## NEAR production path

### Registry contract

`contracts/nest-registry` implements:

- `handle -> account/display name` and reverse lookup;
- one handle per predecessor account;
- reserved/syntax validation;
- config for owner, sponsor, USDC contract and raw-unit network fee;
- `ft_on_transfer` payment routing;
- full unused-amount refund for unknown/malformed payment messages;
- exact recipient forwarding followed by sponsor reimbursement;
- structured registration/payment events for indexing.

### Sponsored activation and meta transactions

Delegates cannot create every primitive needed for a new account, so activation is a sponsor-assisted sequence:

1. sponsor funds minimum account/access-key activation;
2. USDC storage registration is completed;
3. user signs a NEP-366 delegate for `register_handle`;
4. relayer submits the unmodified delegate;
5. indexer confirms the handle.

### Payment path

1. App resolves the handle through the indexer/contract.
2. Sender signs a delegate for the USDC `ft_transfer_call` (or submits directly when eligible).
3. USDC calls the registry hook with handle/reference metadata.
4. Registry forwards the exact amount to the recipient and the tiny sponsor amount after recipient success.
5. Indexer records the event/receipt and reconciles any linked invoice.

### Cross-chain path

1. Query the live token list.
2. Request a dry exact-output quote during route verification.
3. Request a real quote only for a promoted route and after user confirmation.
4. Customer deposits from their own source-chain wallet.
5. Poll status until `SUCCESS` and verify the destination NEAR USDC credit.
6. Mark invoices/batches using the verified receipt rather than an optimistic client claim.

## Scaling and hardening gates

- Replace shared web-process key handling with an isolated signer and KMS/HSM-backed envelope encryption.
- Add Postgres transactions/idempotency keys and an event indexer.
- Add device/session revocation and step-up authentication.
- Add rate limits, sponsor balance alarms and per-account sponsorship caps.
- Add contract testnet integration tests, independent review and monitored relayer infrastructure.
