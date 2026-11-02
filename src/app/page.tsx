import Link from "next/link";
import { getStats } from "@/lib/db";
import { formatUSD } from "@/lib/money";
import { SOURCE_ROUTES } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const stats = getStats();
  return (
    <div className="stack page-stack">
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">NEAR Enabled Settlement & Transfers</p>
          <h1 className="display">Bring the boring money onchain.</h1>
          <p className="lead">Give your shop, team or creator page one payable <strong>@handle</strong>. Customers pay invoices, tips and wages from supported chains — everything settles as one simple USDC balance on NEAR.</p>
          <div className="row wrap">
            <Link className="btn btn-gold btn-large" href="/claim">Claim your @handle</Link>
            <Link className="btn btn-secondary btn-large" href="/@mystore">Try @mystore</Link>
          </div>
          <div className="trust-row" aria-label="Key promises">
            <span>✓ 0% NEST fee</span><span>✓ Recipient gets the exact amount</span><span>✓ No hex address</span><span>✓ One balance</span>
          </div>
        </div>

        <aside className="hero-card" aria-label="How routes settle into one NEST balance">
          <div className="hero-card-top"><span className="badge badge-gold">Many chains in</span><span className="small">Exact-output quotes</span></div>
          <div className="route-chips">
            {SOURCE_ROUTES.slice(0, 8).map((r) => <span key={r.id}>{r.chain} {r.token}</span>)}
            <span>+ {SOURCE_ROUTES.length - 8} target routes</span>
          </div>
          <div className="route-arrow" aria-hidden="true">↓</div>
          <div className="nest-balance">
            <span className="small">@mystore · NEST wallet</span>
            <strong>{formatUSD(stats.volumeCents)}</strong>
            <span>settled in this prototype ledger</span>
          </div>
          <p className="small hero-note">Customers do not need a NEST wallet to pay a public link. Merchants always receive USDC on NEAR.</p>
        </aside>
      </section>

      <section className="stat-strip" aria-label="Live prototype stats">
        <div><span>Handles claimed</span><strong>{stats.handles}</strong></div>
        <div><span>Payments settled</span><strong>{stats.payments}</strong></div>
        <div><span>Payment volume</span><strong>{formatUSD(stats.volumeCents)}</strong></div>
        <div><span>Free claims sponsored</span><strong>{stats.claimsSponsored}</strong></div>
      </section>

      <section className="stack">
        <div className="section-head"><p className="eyebrow">One primitive</p><h2>@handle + dollars + reference</h2><p className="muted">The same simple object powers a tip, a shop QR, an invoice and a payroll batch.</p></div>
        <div className="grid-3">
          <article className="card card-pad feature-card"><span className="feature-icon">↗</span><h3>Pay one person</h3><p>Send to @alice instead of checking a 64-character account ID. Unknown handles are blocked before money moves.</p><Link href="/send">Send a payment →</Link></article>
          <article className="card card-pad feature-card"><span className="feature-icon">▦</span><h3>Get paid anywhere</h3><p>Share a public page, printed QR or fixed invoice link. The amount and reference stay attached for reconciliation.</p><Link href="/pay/link_seed_invoice">Open the sample invoice →</Link></article>
          <article className="card card-pad feature-card"><span className="feature-icon">☰</span><h3>Run simple payroll</h3><p>Paste names and amounts, review every resolved recipient, then pay the whole team under one batch ID.</p><Link href="/send">Try batch payroll →</Link></article>
        </div>
      </section>

      <section className="demo-band">
        <div className="section-head"><p className="eyebrow light">60-second judge path</p><h2>Do this → see that</h2></div>
        <ol className="demo-steps">
          <li><strong>Claim</strong><span>Enter any email, use the demo OTP, choose a permanent handle.</span></li>
          <li><strong>Fund test wallet</strong><span>Add $100 demo USDC from the wallet. No real funds.</span></li>
          <li><strong>Pay @mystore</strong><span>See the exact recipient amount, $0 NEST fee and 1¢ network amount.</span></li>
          <li><strong>Pay from Base</strong><span>Switch the merchant page to another chain and settle the clearly-labelled simulated quote.</span></li>
          <li><strong>Run payroll</strong><span>Paste three rows, watch names resolve, pay everyone with one batch charge.</span></li>
        </ol>
        <div className="row wrap"><Link className="btn btn-gold" href="/claim">Start the demo</Link><Link className="btn btn-light" href="/docs">Read the judge guide</Link></div>
      </section>

      <section className="grid-2">
        <article className="card card-pad stack">
          <p className="eyebrow">Cross-chain, without fake support</p>
          <h2 className="h3">Routes light up only after live proof</h2>
          <p className="muted">NEST targets 13 inbound routes, but a route is only called live when the exact asset exists in the live 1Click token list and a dry exact-output quote succeeds. Until then, the interface labels it as a target or simulation — never as settled mainnet volume.</p>
          <div className="route-list">{SOURCE_ROUTES.map((r) => <span key={r.id}>{r.chain} · {r.token}</span>)}</div>
          <Link className="btn btn-secondary" href="/stats">See route status</Link>
        </article>
        <article className="card card-pad stack security-teaser">
          <p className="eyebrow">Honest custody</p>
          <h2 className="h3">Email recovery has a real trade-off</h2>
          <p>Wallet keys are encrypted on NEST servers so the same email restores the same wallet. <strong>NEST can decrypt them.</strong> That is custodial-adjacent — not non-custodial — and we say so before claim, in the wallet, and on the security page.</p>
          <Link className="btn btn-primary" href="/security">Read the security model</Link>
        </article>
      </section>
    </div>
  );
}
