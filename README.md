# N.E.S.T

## NEAR Enabled Settlement & Transfers

**Bring the boring money onchain.**

NEST gives a creator, merchant, freelancer or small team one payable **@handle** for tips, invoices, shop payments and payroll. Customers can start from supported chains; the recipient always sees one simple **USDC balance on NEAR** — no wallet address to read, no chain menu to teach, no recipient haircut.

> NEST is where money from every chain comes home.

## Live demo

- **App:** https://nest-near-settlements.vercel.app
- **Merchant page:** https://nest-near-settlements.vercel.app/@mystore
- **Sample invoice:** https://nest-near-settlements.vercel.app/pay/link_seed_invoice
- **Source branch:** https://github.com/Arinzaay007/N.E.S.T/tree/arena/64a02649-n-e-s-t

The hosted deployment is the Bit 1 prototype described below. Cross-chain quotes remain simulated unless the UI explicitly labels a guarded 1Click quote as live.

## Current build status

| Layer | Bit 1 status |
|---|---|
| Product app | ✅ Runnable locally and deployed on Vercel: email sign-in, wallet creation, handle claim, pay pages, invoices, QR codes, batch payroll, receipts and CSV export |
| Money/name logic | ✅ Pure TypeScript libraries with unit tests |
| Wallet model | ✅ Real ed25519 key generation; private key encrypted with AES-256-GCM before storage |
| Ledger | ⚠️ Prototype ledger (`.data/` locally, `/tmp/nest-data` on Vercel) for zero-infrastructure judging; not production persistence |
| Cross-chain quotes | ⚠️ Exact-output quote UX, token lookup and dry-route verification implemented; live settlement remains guarded/off by default and quotes are **SIMULATED** unless explicitly labelled live |
| NEAR reads | ⚠️ Read-only RPC readiness, registry resolution and USDC balance/storage checks implemented; no app signing yet |
| NEAR contract | ⚠️ Rust registry/payment-router source and CI workflow included; not compiled or deployed in this sandbox because Rust/NEAR CLI are unavailable |
| Mainnet proof | ⛔ Not yet executed; requires explicit human approval, accounts and route verification |

Do not send real funds to a simulated deposit address.

## Run it locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Open `http://localhost:3000`.

No database or secrets are required. On first run the app creates ignored local demo state under `.data/`.

## 60-second demo: do X → see Y

1. Go to **Claim** and enter any email.
   - See a demo OTP on screen (production mode emails it instead).
2. Claim a handle such as `@yourshop`.
   - A real ed25519 NEAR-format keypair is generated; only the encrypted private key is stored.
3. In **Wallet**, choose **Add $100 demo USDC**.
   - Balance, activity and a receipt update immediately.
4. Open **/@mystore** and pay with NEST.
   - `@mystore` receives the exact amount; NEST fee is $0.00; a tiny network amount is charged on top.
5. On `@mystore`, switch to **Pay from another chain** and request a Base quote.
   - You see an exact-output quote, expiry and deposit address. In default mode it is clearly marked **Simulated demo**.
6. Open **Send → Batch payroll**.
   - The prefilled three-person batch resolves every handle. Change one name to an unknown handle and the batch hard-blocks.
7. Create an invoice in **Wallet → Invoices**, then open its `/pay/...` link.
   - The amount and reference are fixed; payment flips the invoice to PAID and remains in exportable activity.

### Seeded demo identities

Sign in with a seeded email and the on-screen demo OTP:

| Handle | Email |
|---|---|
| `@mystore` | `store@demo.nest` |
| `@alice` | `alice@demo.nest` |
| `@arinzaay` | `arinzaay@demo.nest` |
| `@sulaimon` | `sulaimon@demo.nest` |
| `@chidi` | `chidi@demo.nest` |

Seeded unpaid invoice: `/pay/link_seed_invoice`.

## Product scope

### Included in v1

- Permanent internal `@handles`: 3–20 lowercase letters, numbers or underscores; one per verified email/wallet.
- Email-OTP wallet creation and restoration.
- Public payable profile at `/@handle`.
- Pay one person by name.
- Batch payroll from pasted `@handle amount memo` rows.
- Merchant-lite invoices: fixed amount, reference, link, QR, paid status, activity and CSV export.
- Personal, merchant and invoice QR codes; paste/scan-result parsing on the send screen.
- Cross-chain exact-output quote flow into NEAR USDC.
- Public `/stats`, explanatory `/docs`, and plain-English `/security`.

### Deliberately excluded

- Escrow for unregistered names: unknown means **User not found**, before money moves.
- Storefronts, subscriptions, POS hardware, plugins, public merchant APIs and webhooks.
- Recurring payroll, tax, approvals and accounting suites.
- Renaming or transferring handles.
- Recipient token choice: settlement is always USDC on NEAR.

## Money rules

- **Platform fee: 0%.**
- Recipient receives the exact requested amount.
- Cross-chain routing cost is shown to the sender before deposit.
- First wallet claim/activation is sponsor-funded.
- Later NEST→NEST payments add a tiny USDC network amount **on top** to reimburse the sponsor (1¢ in this prototype).
- A payroll batch has one network amount, not one visible charge per person.

Example: send $25.00 → recipient receives $25.00 → sponsor receives about $0.01 → sender pays $25.01.

## Cross-chain route policy

NEST targets these inbound routes:

Base USDC · Solana USDC · Arbitrum USDC · Ethereum USDC · BSC USDC · Optimism USDC · Polygon USDC · Avalanche USDC · Celo USDC · TON GRAM · Robinhood USDG · Plasma USDT0 · X Layer USDC.

A route may only be called **live** after both checks pass:

1. the exact origin asset exists in the live NEAR Intents/1Click token list; and
2. a dry **EXACT_OUTPUT** quote to NEAR USDC succeeds.

If either check fails, the route remains a labelled target/simulation. Base USDC is the first proof route.

## Architecture

```text
Public @page / invoice / QR
          │
          ├─ NEST balance ──────► handle resolver ─► USDC settlement
          │
          └─ Other chain ───────► 1Click exact-output quote
                                  └─ deposit + status ─► USDC on NEAR

Email OTP ─► encrypted wallet ─► permanent @handle
Paste list ─► validate all rows ─► one batch ID ─► many settlements
```

Key seams:

- `src/lib/money.ts` — integer-cent parsing/formatting; no floating-point ledger math.
- `src/lib/handle.ts` — canonical handle and email validation.
- `src/lib/batch.ts` — payroll parser with line-level errors.
- `src/lib/quotes.ts` — route catalogue and exact-output simulation math.
- `src/lib/oneClick.ts` — guarded live 1Click token discovery, quote and status adapter.
- `src/lib/crypto.ts` — AES-256-GCM, hashed OTP support, signed tokens and NEAR implicit-account key generation.
- `src/lib/db.ts` — prototype ledger boundary intended to be replaced by Postgres + chain indexer.
- `contracts/nest-registry` — NEAR handle registry and validated USDC `ft_on_transfer` payment router source.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the production migration path.

## NEAR design

- **Handle registry contract:** canonical `@handle → account ID` records and structured payment events.
- **NEP-141 USDC:** `ft_transfer_call` into the registry; only the configured USDC predecessor can route value.
- **NEP-366 meta transactions:** signed delegate actions for sponsored onboarding/eligible calls; a relayer cannot rewrite a delegate it merely submits.
- **NEAR Intents / 1Click:** exact-output inbound quotes, quote-specific deposits and status polling.
- **Sponsor/relayer:** a dedicated low-balance account funds activation and eligible gas, replenished by tiny USDC reimbursements.

## Security disclosure

This is not presented as non-custodial:

> N.E.S.T Wallet keys are encrypted on our servers so the same email restores the same wallet. We can decrypt them. Protect your email. Lose access to your email and don’t export your recovery phrase, and your funds may be gone.

See [SECURITY.md](SECURITY.md) and the in-app `/security` page.

## Configuration

Copy `.env.example` to `.env.local` only when you need non-demo behavior. Important flags:

- `NEST_DEMO_OTP=false` hides the on-screen OTP.
- `RESEND_API_KEY` and `EMAIL_FROM` enable email delivery.
- `NEST_DEMO_FAUCET=false` disables test funds.
- `ONE_CLICK_ENABLED=true` enables guarded live quote attempts when a refund address is supplied.
- `ONE_CLICK_FALLBACK=false` makes unavailable live routes fail instead of returning a simulated quote.

Never commit real secrets.

## Verify

```bash
npm test
npm run typecheck
npm run build
grep -RInEi 'w[i]nk' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.data . || true
```

The final scan must return no project-content hits before a commit, push or submission.

## Documentation

- [Judge guide](docs/JUDGE_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Real integration runbook](docs/REAL_INTEGRATION.md)
- [Testing](docs/TESTING.md)
- [Roadmap and verification gates](docs/ROADMAP.md)
- [Contract README](contracts/nest-registry/README.md)

## Hackathon fit

Primary track: **Real-World Money** (`realworld`) — merchant payments, invoicing and payroll.

Secondary track: **Open Innovation** (`open`) — a chain-abstracted name layer for everyday settlement.
