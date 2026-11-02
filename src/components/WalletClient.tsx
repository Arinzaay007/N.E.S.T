"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CopyButton from "./CopyButton";
import QrCode from "./QrCode";
import { formatUSD, parseAmountToCents } from "@/lib/money";
import type { PaymentLink, Transfer } from "@/lib/types";

interface DashUser { id: string; handle: string; displayName: string; accountId: string; email: string; balanceCents: number; publicKey: string; avatarColor: string; createdAt: string }
interface Dashboard { user: DashUser; transfers: Transfer[]; links: PaymentLink[]; sponsor: { collectedCents: number; claimsSponsored: number } }
type Tab = "overview" | "receive" | "invoices" | "activity" | "batches" | "security";

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}
function dateText(iso: string) { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "N"; }

export default function WalletClient() {
  const router = useRouter();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [origin, setOrigin] = useState("");
  const [title, setTitle] = useState("Website design deposit");
  const [invoiceAmount, setInvoiceAmount] = useState("25.00");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) { setDash(null); return; }
    setDash(await res.json());
  }

  useEffect(() => { setOrigin(window.location.origin); refresh().finally(() => setChecked(true)); }, []);

  const batches = useMemo(() => {
    if (!dash) return [];
    const map = new Map<string, Transfer[]>();
    for (const t of dash.transfers) if (t.batchId) map.set(t.batchId, [...(map.get(t.batchId) ?? []), t]);
    return [...map.entries()].map(([id, transfers]) => ({ id, transfers, total: transfers.reduce((s, t) => s + t.amountCents, 0), createdAt: transfers[0]?.createdAt }));
  }, [dash]);

  async function addFunds() {
    setBusy(true); setError(null); setNotice(null);
    try { await postJson("/api/faucet"); setNotice("Added $100 demo USDC."); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not add funds."); } finally { setBusy(false); }
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = parseAmountToCents(invoiceAmount);
    if (!amountCents) return setError("Enter a valid invoice amount.");
    setBusy(true); setError(null); setNotice(null);
    try { await postJson("/api/payment-links", { title, amountCents, reference: reference || undefined }); setNotice("Invoice link created."); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not create invoice."); } finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/"); router.refresh();
  }

  function exportCsv() {
    if (!dash) return;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["date", "kind", "from", "to", "amount_usd", "network_usd", "memo", "receipt"], ...dash.transfers.map((t) => [t.createdAt, t.kind, t.fromHandle ?? t.sourceChain ?? "demo faucet", t.toHandle, (t.amountCents / 100).toFixed(2), (t.networkFeeCents / 100).toFixed(2), t.memo ?? "", t.receiptId])];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nest-${dash.user.handle}-activity.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  if (!checked) return <div className="card card-pad">Loading your wallet…</div>;
  if (!dash) {
    return <div className="card card-pad narrow stack"><h1 className="h2">Open your NEST wallet</h1><p className="muted">Sign in with email to see one USDC-on-NEAR balance, invoices, QR codes and payroll history.</p><Link className="btn btn-primary btn-block" href="/claim?next=/wallet">Continue with email</Link></div>;
  }

  const { user, transfers, links } = dash;
  const profileUrl = `${origin}/@${user.handle}`;
  const payAmountUrl = `${profileUrl}?amount=10.00`;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" }, { id: "receive", label: "Receive" }, { id: "invoices", label: "Invoices" },
    { id: "activity", label: "Activity" }, { id: "batches", label: "Batches" }, { id: "security", label: "Security" },
  ];

  const activity = (list: Transfer[]) => list.length ? list.map((t) => {
    const outgoing = t.fromUserId === user.id;
    const counterparty = outgoing ? `@${t.toHandle}` : t.fromHandle ? `@${t.fromHandle}` : t.sourceChain ? `${t.sourceChain} customer` : "Demo funds";
    return <div key={t.id} className="activity-row"><div><strong>{outgoing ? "→" : "←"} {counterparty}</strong><span className="small muted block">{t.memo ?? t.kind.replaceAll("_", " ")} · {dateText(t.createdAt)}</span><span className="small muted block">Receipt <code>{t.receiptId.slice(0, 14)}…</code></span></div><strong className={outgoing ? "amount-out" : "amount-in"}>{outgoing ? "-" : "+"}{formatUSD(t.amountCents)}</strong></div>;
  }) : <p className="muted">No activity yet.</p>;

  return (
    <div className="stack">
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      <section className="wallet-hero card">
        <div className="row gap">
          <span className="avatar large" style={{ background: user.avatarColor }}>{initials(user.displayName)}</span>
          <div><p className="eyebrow light">@{user.handle}</p><h1>{formatUSD(user.balanceCents)}</h1><p>One balance · USDC on NEAR</p></div>
        </div>
        <div className="wallet-actions">
          <Link className="btn btn-gold" href="/send">Send / payroll</Link>
          <button className="btn btn-light" onClick={() => setTab("receive")}>Receive QR</button>
          <button className="btn btn-light" onClick={addFunds} disabled={busy}>Add $100 demo USDC</button>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Wallet sections">
        {tabs.map((t) => <button key={t.id} type="button" className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === "overview" && (
        <div className="grid-2">
          <section className="card card-pad stack"><h2 className="h3">Your money home</h2><p className="muted">Customers can pay from supported chains. You see one dollar balance, not thirteen wallets.</p><div className="mini-stats"><div><span>Payments</span><strong>{transfers.filter((t) => t.kind !== "FAUCET").length}</strong></div><div><span>Open invoices</span><strong>{links.filter((l) => l.status === "UNPAID").length}</strong></div><div><span>Batches</span><strong>{batches.length}</strong></div></div><Link className="btn btn-secondary" href={`/@${user.handle}`}>View public page</Link></section>
          <section className="card card-pad stack"><div className="row space-between"><h2 className="h3">Recent activity</h2><button className="btn btn-ghost" onClick={() => setTab("activity")}>View all</button></div>{activity(transfers.slice(0, 5))}</section>
        </div>
      )}

      {tab === "receive" && (
        <div className="grid-2">
          <section className="card card-pad stack center"><h2 className="h3">Personal / merchant QR</h2><QrCode value={profileUrl} size={210} /><p className="muted">Print it, post it, or put it on a receipt. It opens @{user.handle}.</p><code className="address-box">{profileUrl}</code><div className="row wrap center-row"><CopyButton text={profileUrl} label="Copy payment link" /><Link className="btn btn-primary" href={`/@${user.handle}`}>Open page</Link></div></section>
          <section className="card card-pad stack"><h2 className="h3">Ways people pay you</h2><div className="feature-list"><p><strong>NEST handle:</strong> another NEST user sends from their USDC balance.</p><p><strong>Payment page:</strong> a customer chooses a supported source chain and sees the exact output before depositing.</p><p><strong>Invoice:</strong> fixed amount + reference, marked paid automatically in the prototype ledger.</p></div><label className="field"><span>Example $10 link</span><div className="copy-row"><code className="address-box">{payAmountUrl}</code><CopyButton text={payAmountUrl} /></div></label><details><summary>Technical receive details</summary><p className="small muted">NEAR implicit account ID</p><code className="address-box">{user.accountId}</code><CopyButton text={user.accountId} label="Copy account ID" /></details></section>
        </div>
      )}

      {tab === "invoices" && (
        <div className="grid-2">
          <form className="card card-pad stack" onSubmit={createInvoice}><h2 className="h3">Create an invoice link</h2><label className="field"><span>What is it for?</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required /></label><label className="field"><span>Amount</span><div className="money-input"><span>$</span><input className="input" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} inputMode="decimal" required /></div></label><label className="field"><span>Reference <em className="muted">(optional)</em></span><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INV-1042" maxLength={40} /></label><button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create payment link"}</button><p className="small muted">Merchant-lite: link, QR, fixed amount, reference, paid status, receipts and export. No storefront complexity.</p></form>
          <section className="card card-pad stack"><h2 className="h3">Your invoices</h2>{links.length ? links.map((l) => { const url = `${origin}/pay/${l.id}`; return <div key={l.id} className="invoice-row"><div><strong>{l.title}</strong><span className="small muted block">{l.reference} · {formatUSD(l.amountCents)} · {dateText(l.createdAt)}</span></div><span className={l.status === "PAID" ? "badge badge-success" : "badge badge-warn"}>{l.status}</span><div className="row wrap"><CopyButton text={url} label="Copy link" /><Link className="btn btn-secondary" href={`/pay/${l.id}`}>Open</Link></div>{l.status === "UNPAID" && <QrCode value={url} size={120} />}</div>; }) : <p className="muted">No invoices yet.</p>}</section>
        </div>
      )}

      {tab === "activity" && <section className="card card-pad stack"><div className="row space-between wrap"><h2 className="h3">Activity & receipts</h2><button className="btn btn-secondary" onClick={exportCsv}>Export CSV</button></div>{activity(transfers)}</section>}

      {tab === "batches" && <section className="card card-pad stack"><h2 className="h3">Payroll batches</h2>{batches.length ? batches.map((b) => <div key={b.id} className="batch-card"><div className="row space-between"><strong>{b.transfers.length} people · {formatUSD(b.total)}</strong><span className="small muted">{b.createdAt ? dateText(b.createdAt) : ""}</span></div><p className="small muted">Batch <code>{b.id}</code> · one network amount for the batch</p>{activity(b.transfers)}</div>) : <p className="muted">No batches yet. Try Batch payroll on the Send page.</p>}<Link className="btn btn-primary" href="/send">Run a batch</Link></section>}

      {tab === "security" && (
        <section className="card card-pad stack">
          <h2 className="h3">Wallet & security</h2>
          <div className="alert alert-warn"><strong>Read this plainly:</strong> NEST Wallet keys are encrypted on our servers so the same email restores the same wallet. We can decrypt them. Protect your email. Lose access to your email and don’t export recovery material, and your funds may be gone.</div>
          <label className="field"><span>Email</span><input className="input" value={user.email} readOnly /></label>
          <label className="field"><span>NEAR account ID</span><div className="copy-row"><code className="address-box">{user.accountId}</code><CopyButton text={user.accountId} /></div></label>
          <label className="field"><span>Public key</span><code className="address-box">{user.publicKey}</code></label>
          <div className="feature-list"><p><strong>Key export:</strong> required before mainnet custody; intentionally not exposed through this prototype API.</p><p><strong>Sessions:</strong> production needs device/session revocation and step-up re-auth for export and large payments.</p><p><strong>Handle:</strong> permanent in v1; one per verified email/wallet.</p></div>
          <div className="row wrap"><Link className="btn btn-secondary" href="/security">Read security model</Link><button className="btn btn-ghost danger" onClick={logout}>Sign out</button></div>
        </section>
      )}
    </div>
  );
}
