# Testing

## Automated checks

Run from the repository root:

```bash
npm install
npm test
npm run typecheck
npm run build
```

Expected:

- Vitest covers money parsing/formatting, handle rules, payroll parsing and simulated exact-output behavior.
- TypeScript completes with no errors.
- Next.js production build completes and lists the app/API routes.

## Local state reset

The demo persists to `.data/`, which is ignored by Git. To return to seeded data, stop the dev server and remove the local database file:

```bash
rm -f .data/nest-db.json
```

Do not delete `.data/*-key` casually while retaining an old database: previously encrypted wallet keys require the corresponding local encryption secret.

## Manual acceptance checklist

### Identity

- [ ] Invalid email is rejected.
- [ ] Demo OTP appears only when `NEST_DEMO_OTP` is not `false`.
- [ ] Wrong OTP fails; repeated attempts eventually invalidate the code.
- [ ] Taken, reserved, too-short and invalid-character handles are blocked.
- [ ] Signing in again with the same email restores the same handle and balance.

### Payments

- [ ] Unknown handle says “User not found” and cannot be paid.
- [ ] Sender cannot pay self.
- [ ] Recipient receives the exact amount.
- [ ] Sender total includes one 1¢ network amount.
- [ ] Insufficient balance makes no partial balance changes.
- [ ] Every settled payment has a receipt in activity/CSV.

### Payroll

- [ ] Comments and blank lines are ignored.
- [ ] Malformed rows report their line number.
- [ ] One unknown row blocks the entire send button.
- [ ] A valid batch groups all transfers under one batch ID.
- [ ] Batch sender is charged only one network amount.

### Invoices and QR

- [ ] Invoice amount is fixed on the payment page.
- [ ] Wrong recipient/full-amount mismatch is rejected by the API.
- [ ] Paid invoices cannot be paid twice.
- [ ] Profile and invoice QRs open absolute URLs for the current host.
- [ ] Pasting a profile URL into Send fills handle/amount/memo when present.

### Cross-chain safety

- [ ] Default quote is labelled **Simulated demo**.
- [ ] Simulated address has an explicit “do not send real funds” warning.
- [ ] Live mode requires `ONE_CLICK_ENABLED=true` and a refund address.
- [ ] A live quote cannot use the simulated settle endpoint.
- [ ] A live quote credits only after status `SUCCESS` in the prototype flow.

## Route verification procedure (before calling any route live)

For each candidate origin asset:

1. Fetch the current 1Click token list and record the exact `assetId`, blockchain, symbol and decimals.
2. Confirm the destination NEAR USDC `assetId`.
3. Submit a **dry** `EXACT_OUTPUT` quote for a tiny amount with valid recipient/refund addresses.
4. Record the returned input amount, deposit format, memo requirement and deadline.
5. Only after human approval, test with a capped tiny real amount and retain source/destination explorer links.
6. Promote the route in UI copy only after destination credit and invoice reconciliation are proven.

## Repository hygiene

Before every commit, push or submission:

```bash
grep -RInEi 'w[i]nk' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.data . || true
git log --format=%B | grep -i 'w[i]nk' || true
```

Both scans must be empty.
