import type { Metadata } from "next";
import Link from "next/link";
import { getStats } from "@/lib/db";
import { formatUSD } from "@/lib/money";
import { SOURCE_ROUTES } from "@/lib/quotes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live stats" };

function dateText(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function StatsPage() {
  const stats = getStats();
  return (
    <div className="stack page-stack">
      <header className="page-intro">
        <p className="eyebrow">Transparent by default</p>
        <h1>Live prototype stats</h1>
        <p className="lead">These numbers come from the local NEST ledger. Demo-faucet credits are excluded from payment volume; simulated cross-chain activity is never presented as mainnet volume.</p>
      </header>

      <section className="stat-strip" aria-label="NEST totals">
        <div><span>Handles</span><strong>{stats.handles}</strong></div>
        <div><span>Payments</span><strong>{stats.payments}</strong></div>
        <div><span>Volume</span><strong>{formatUSD(stats.volumeCents)}</strong></div>
        <div><span>Sponsor collected</span><strong>{formatUSD(stats.sponsorCollectedCents)}</strong></div>
        <div><span>Claims sponsored</span><strong>{stats.claimsSponsored}</strong></div>
      </section>

      <div className="grid-2">
        <section className="card card-pad stack">
          <div className="row space-between"><h2 className="h3">Recent settled payments</h2><span className="badge badge-success">Ledger live</span></div>
          {stats.recent.length ? stats.recent.map((t) => (
            <div className="activity-row" key={t.id}>
              <div><strong>{t.fromHandle ? `@${t.fromHandle}` : t.sourceChain ?? "External"} → @{t.toHandle}</strong><span className="small muted block">{t.memo ?? t.kind.replaceAll("_", " ")} · {dateText(t.createdAt)}</span><span className="small muted block">Receipt <code>{t.receiptId.slice(0, 16)}…</code></span></div>
              <strong>{formatUSD(t.amountCents)}</strong>
            </div>
          )) : <p className="muted">No payments yet.</p>}
        </section>

        <section className="card card-pad stack">
          <h2 className="h3">Inbound route targets</h2>
          <p className="muted">A target is not a claim of live support. Each chain must pass two gates: exact asset present in the live 1Click token list, then a successful dry exact-output quote.</p>
          <div className="route-table">
            {SOURCE_ROUTES.map((r) => <div key={r.id} className="route-row"><span><strong>{r.chain}</strong> · {r.token}</span><span className="badge badge-warn">Verify quote</span></div>)}
          </div>
          <p className="small muted">First filmed proof target: Base USDC → USDC on NEAR, capped and human-approved.</p>
          <Link className="btn btn-secondary" href="/docs#routes">Route promotion rules</Link>
        </section>
      </div>

      <section className="card card-pad stack">
        <h2 className="h3">Sponsor economics</h2>
        <p className="muted">The first claim/activation is sponsored. After that, a NEST-to-NEST payment adds a tiny network amount on top — 1¢ in this prototype — while the recipient still gets the full amount and NEST charges a 0% platform fee. Sponsor USDC is periodically converted back to NEAR for gas in production.</p>
      </section>
    </div>
  );
}
