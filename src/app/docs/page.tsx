import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How NEST works" };

export default function DocsPage() {
  return (
    <div className="doc-layout page-stack">
      <aside className="doc-nav card card-pad">
        <strong>On this page</strong>
        <a href="#judge-path">Judge path</a><a href="#primitive">Payment primitive</a><a href="#flows">Core flows</a><a href="#routes">Route rules</a><a href="#near">NEAR design</a><a href="#api">API surface</a><a href="#economics">Economics</a><a href="#status">Build status</a>
      </aside>

      <article className="card card-pad doc-body stack">
        <header>
          <p className="eyebrow">N.E.S.T product & technical guide</p>
          <h1>How NEST works</h1>
          <p className="lead">NEST replaces wallet addresses and chain choices with a name people already understand: <strong>@handle</strong>. The merchant keeps one USDC balance on NEAR while customers start from the chain where their money already sits.</p>
        </header>

        <section id="judge-path" className="stack">
          <h2>Judge path: do X → see Y</h2>
          <ol className="number-list">
            <li>Open <Link href="/claim">Claim</Link>, enter an email, copy the on-screen demo OTP → the app creates an ed25519 wallet and asks for a permanent handle.</li>
            <li>Open <Link href="/wallet">Wallet</Link> and add $100 demo USDC → the balance, receipt and activity update immediately.</li>
            <li>Open <Link href="/@mystore">@mystore</Link> and pay with NEST → the recipient amount stays exact; you see $0 platform fee plus a 1¢ network amount.</li>
            <li>On the same page choose “Pay from another chain” → an exact-output quote appears with mode, deposit address and expiry. Simulated quotes are labelled and must not receive real funds.</li>
            <li>Open <Link href="/send">Send → Batch payroll</Link> → every pasted handle resolves or blocks the batch; one network amount covers the batch.</li>
            <li>Open <Link href="/pay/link_seed_invoice">the seeded invoice</Link> → amount/reference are fixed and the invoice becomes PAID after settlement.</li>
          </ol>
        </section>

        <section id="primitive" className="stack">
          <h2>The payment primitive</h2>
          <div className="primitive-box"><code>@handle</code><span>+</span><code>$ amount</code><span>+</span><code>optional memo/reference</code></div>
          <p>Handles are 3–20 lowercase letters, numbers or underscores; one per verified email/wallet; permanent in v1. Reserved names are unavailable. There is deliberately no escrow for unclaimed names: an unknown handle returns “User not found” before signing or settlement.</p>
        </section>

        <section id="flows" className="stack">
          <h2>Core flows</h2>
          <h3>NEST → NEST</h3><p>Resolve handle → confirm display name and exact amount → charge the network amount on top → settle USDC → emit a receipt. A batch repeats the recipient leg under one batch ID with one network amount.</p>
          <h3>Merchant / invoice</h3><p>The merchant shares a public @page, static QR or fixed invoice. Customers need no NEST wallet for cross-chain checkout. The invoice reference travels into the transfer memo and CSV export.</p>
          <h3>Other chain → NEST</h3><p>Discover live assets → request an exact-output quote → show source amount, recipient amount, deposit address and expiry → customer deposits from their own wallet → poll status → credit only on SUCCESS.</p>
        </section>

        <section id="routes" className="stack">
          <h2>Route promotion rules</h2>
          <p>Target routes are Base, Solana, Arbitrum, Ethereum, BSC, Optimism, Polygon, Avalanche, Celo, TON, Robinhood, Plasma and X Layer. A route can be called live only when:</p>
          <ol className="number-list"><li>the exact origin asset is present in the live 1Click token list;</li><li>a dry exact-output quote to NEAR USDC succeeds;</li><li>the UI can present the correct deposit format and refund path.</li></ol>
          <p>If any gate fails, NEST must hide or label the route rather than simulate “support.” Base USDC is the first proof target.</p>
        </section>

        <section id="near" className="stack">
          <h2>NEAR-native design</h2>
          <ul className="check-list">
            <li><strong>Handle registry contract:</strong> canonical handle → account/public-key mapping; source is in <code>contracts/nest-registry</code>.</li>
            <li><strong>NEP-141 USDC:</strong> one settlement asset and balance for recipients.</li>
            <li><strong>NEP-366 meta transactions:</strong> signed delegate actions let a relayer submit a user-approved call without changing its method, args or deposit.</li>
            <li><strong>NEAR Intents / 1Click:</strong> exact-output inbound routing into NEAR USDC.</li>
            <li><strong>Sponsor:</strong> funds first activation and advances eligible gas; tiny USDC reimbursements refill the sponsor over time.</li>
          </ul>
        </section>

        <section id="api" className="stack">
          <h2>Prototype API surface</h2>
          <div className="code-block"><pre>{`POST /api/auth/request       request email OTP
POST /api/auth/verify        verify OTP / start claim
POST /api/auth/claim         create wallet + handle
GET  /api/handles/check      validate + resolve handle
POST /api/transfers          pay one or a batch
POST /api/payment-links      create invoice
POST /api/crosschain/quote   exact-output quote
GET  /api/crosschain/status  poll live quote
GET  /api/stats              public aggregate stats`}</pre></div>
        </section>

        <section id="economics" className="stack">
          <h2>Economics</h2>
          <p>Platform fee: <strong>0%</strong>. Recipient receives the exact requested amount. Cross-chain senders see routing/network cost in the quote. NEST-to-NEST senders pay a tiny USDC network amount on top after the sponsored first claim. Sustainability comes from keeping NEAR execution cheap, capping sponsorship, and later charging businesses for optional operations tooling — not by shaving the recipient’s payment.</p>
        </section>

        <section id="status" className="stack">
          <h2>Honest build status</h2>
          <div className="alert alert-warn">Bit 1 is a fully runnable product prototype with encrypted email wallets, handle resolution, invoices, payroll, a local ledger, simulated quotes and a live-1Click adapter boundary. The Rust registry source is included, but this sandbox has no Rust/NEAR CLI, so contract compilation and deployment are a separate verification gate — not claimed here.</div>
          <p>Run <code>npm test</code>, <code>npm run typecheck</code> and <code>npm run build</code> to verify the app and pure money/name/quote logic locally.</p>
          <div className="row wrap"><Link className="btn btn-primary" href="/claim">Try the product</Link><Link className="btn btn-secondary" href="/security">Security model</Link></div>
        </section>
      </article>
    </div>
  );
}
