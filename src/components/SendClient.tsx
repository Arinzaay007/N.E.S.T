"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { parseBatchText } from "@/lib/batch";
import { normalizeHandle } from "@/lib/handle";
import { formatUSD, NETWORK_FEE_CENTS, parseAmountToCents } from "@/lib/money";
import type { PublicUser, Transfer } from "@/lib/types";

interface MeUser { id: string; handle: string; displayName: string; balanceCents: number }
type CheckState = { status: "idle" | "checking" | "found" | "missing" | "invalid"; user?: PublicUser; message?: string };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

async function checkHandle(raw: string): Promise<CheckState> {
  if (!raw.trim()) return { status: "idle" };
  const res = await fetch(`/api/handles/check?handle=${encodeURIComponent(raw)}`, { cache: "no-store" });
  const data = await res.json();
  if (!data.valid) return { status: "invalid", message: data.error };
  if (!data.user) return { status: "missing", message: "User not found." };
  return { status: "found", user: data.user, message: `${data.user.displayName} · @${data.user.handle}` };
}

export default function SendClient() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mode, setMode] = useState<"one" | "batch">("one");
  const [linkText, setLinkText] = useState("");
  const [handle, setHandle] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [oneCheck, setOneCheck] = useState<CheckState>({ status: "idle" });
  const [batchText, setBatchText] = useState("@sulaimon 50 Design\n@chidi 80 QA testing\n@alice 25 Support");
  const [batchChecks, setBatchChecks] = useState<Record<string, CheckState>>({});
  const [checkingBatch, setCheckingBatch] = useState(false);
  const [sent, setSent] = useState<Transfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshMe() {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) { setMe(null); return; }
    const data = await res.json();
    setMe(data.user);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("to")) setHandle(params.get("to") ?? "");
    if (params.get("amount")) setAmount(params.get("amount") ?? "");
    if (params.get("memo")) setMemo(params.get("memo") ?? "");
    refreshMe().finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      if (!handle.trim()) return setOneCheck({ status: "idle" });
      setOneCheck({ status: "checking", message: "Checking…" });
      setOneCheck(await checkHandle(handle));
    }, 300);
    return () => window.clearTimeout(t);
  }, [handle]);

  const parsed = useMemo(() => parseBatchText(batchText), [batchText]);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      const handles = [...new Set(parsed.items.map((i) => i.handle))];
      if (!handles.length) { setBatchChecks({}); return; }
      setCheckingBatch(true);
      const entries = await Promise.all(handles.map(async (h) => [h, await checkHandle(h)] as const));
      setBatchChecks(Object.fromEntries(entries));
      setCheckingBatch(false);
    }, 350);
    return () => window.clearTimeout(t);
  }, [parsed]);

  const amountCents = parseAmountToCents(amount);
  const missingBatch = parsed.items.filter((i) => batchChecks[i.handle]?.status !== "found");
  const batchReady = parsed.items.length > 0 && parsed.errors.length === 0 && missingBatch.length === 0 && !checkingBatch;

  function parsePastedLink() {
    const raw = linkText.trim();
    if (!raw) return;
    try {
      const url = new URL(raw, window.location.origin);
      const segments = url.pathname.split("/").map(decodeURIComponent).filter(Boolean);
      const last = segments[segments.length - 1] ?? "";
      if (last.startsWith("@")) setHandle(normalizeHandle(last));
      else if (url.searchParams.get("to")) setHandle(normalizeHandle(url.searchParams.get("to")!));
      if (url.searchParams.get("amount")) setAmount(url.searchParams.get("amount")!);
      if (url.searchParams.get("memo")) setMemo(url.searchParams.get("memo")!);
    } catch {
      setHandle(normalizeHandle(raw));
    }
  }

  async function sendOne(e: React.FormEvent) {
    e.preventDefault();
    if (!amountCents) return setError("Enter a valid dollar amount.");
    if (oneCheck.status !== "found") return setError("User not found. Check the handle before sending.");
    setBusy(true); setError(null); setSent([]);
    try {
      const data = await postJson("/api/transfers", { items: [{ handle: oneCheck.user!.handle, amountCents, memo: memo || undefined }] });
      setSent(data.transfers);
      await refreshMe();
    } catch (err) { setError(err instanceof Error ? err.message : "Payment failed."); } finally { setBusy(false); }
  }

  async function sendBatch() {
    if (!batchReady) return setError("Fix every payroll row before sending. Nothing should be guessed.");
    setBusy(true); setError(null); setSent([]);
    try {
      const data = await postJson("/api/transfers", {
        items: parsed.items.map((i) => ({ handle: i.handle, amountCents: i.amountCents, memo: i.memo })),
        forceBatch: true,
      });
      setSent(data.transfers);
      await refreshMe();
    } catch (err) { setError(err instanceof Error ? err.message : "Batch payment failed."); } finally { setBusy(false); }
  }

  if (!authChecked) return <div className="card card-pad">Loading your wallet…</div>;
  if (!me) {
    return (
      <div className="card card-pad narrow stack">
        <h1 className="h2">Sign in to send by @handle</h1>
        <p className="muted">Your email restores the same NEST wallet on any device. New here? Claim a permanent handle first.</p>
        <Link className="btn btn-primary btn-block" href="/claim?next=/send">Continue with email</Link>
        <p className="small muted">Paying a merchant link from another chain? Open their @page or invoice link — no NEST wallet needed.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="balance-strip card">
        <div><span className="small muted">@{me.handle} balance</span><strong>{formatUSD(me.balanceCents)}</strong></div>
        <Link className="btn btn-secondary" href="/wallet">Open wallet</Link>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {sent.length > 0 && (
        <div className="alert alert-success">
          <strong>Settled.</strong> {sent.length} payment{sent.length > 1 ? "s" : ""} sent as USDC on NEAR.
          <ul className="receipt-list">{sent.map((t) => <li key={t.id}>@{t.toHandle} · {formatUSD(t.amountCents)} · <code>{t.receiptId}</code></li>)}</ul>
        </div>
      )}

      <div className="segmented" role="tablist" aria-label="Send type">
        <button type="button" className={mode === "one" ? "seg active" : "seg"} onClick={() => setMode("one")}>Pay one person</button>
        <button type="button" className={mode === "batch" ? "seg active" : "seg"} onClick={() => setMode("batch")}>Batch payroll</button>
      </div>

      {mode === "one" ? (
        <form className="card card-pad stack" onSubmit={sendOne}>
          <div>
            <h1 className="h2">Pay a @handle</h1>
            <p className="muted">No hex address. If the handle does not exist, NEST blocks the payment before anything moves.</p>
          </div>
          <label className="field">
            <span>Paste a payment link or scan result <em className="muted">(optional)</em></span>
            <div className="copy-row"><input className="input" value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="https://…/@alice?amount=25" /><button type="button" className="btn btn-secondary" onClick={parsePastedLink}>Fill</button></div>
          </label>
          <label className="field">
            <span>Recipient</span>
            <div className="handle-input"><span>@</span><input className="input" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/@/g, ""))} placeholder="alice" required /></div>
            {oneCheck.message && <span className={oneCheck.status === "found" ? "field-ok" : "field-error"}>{oneCheck.status === "found" ? `✓ ${oneCheck.message}` : oneCheck.message}</span>}
          </label>
          <label className="field">
            <span>Amount</span>
            <div className="money-input"><span>$</span><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00" required /></div>
          </label>
          <label className="field"><span>Memo <em className="muted">(optional)</em></span><input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this for?" maxLength={140} /></label>
          <div className="quote-box">
            <div className="quote-row"><span>Recipient receives</span><strong>{amountCents ? formatUSD(amountCents) : "—"}</strong></div>
            <div className="quote-row"><span>NEST fee</span><strong>$0.00</strong></div>
            <div className="quote-row"><span>Network amount</span><strong>{formatUSD(NETWORK_FEE_CENTS)}</strong></div>
            <div className="quote-row total"><span>You pay</span><strong>{amountCents ? formatUSD(amountCents + NETWORK_FEE_CENTS) : "—"}</strong></div>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy || oneCheck.status !== "found" || !amountCents}>{busy ? "Sending…" : "Send USDC"}</button>
        </form>
      ) : (
        <section className="card card-pad stack">
          <div>
            <h1 className="h2">Payroll without the spreadsheet pain</h1>
            <p className="muted">Paste one person per line: <code>@handle amount memo</code>. NEST resolves every name first and hard-blocks bad rows.</p>
          </div>
          <label className="field">
            <span>Payment list</span>
            <textarea className="input textarea mono" rows={8} value={batchText} onChange={(e) => setBatchText(e.target.value)} spellCheck={false} />
          </label>
          {parsed.errors.map((e) => <div key={e.line} className="alert alert-error small">Line {e.line}: {e.error} — <code>{e.raw}</code></div>)}
          <div className="stack compact">
            {parsed.items.map((item) => {
              const check = batchChecks[item.handle];
              return (
                <div key={`${item.line}-${item.handle}`} className="activity-row">
                  <div><strong>@{item.handle}</strong><span className="small muted block">{check?.status === "found" ? `✓ ${check.user?.displayName}` : checkingBatch ? "Checking…" : "User not found"}{item.memo ? ` · ${item.memo}` : ""}</span></div>
                  <strong>{formatUSD(item.amountCents)}</strong>
                </div>
              );
            })}
          </div>
          <div className="quote-box">
            <div className="quote-row"><span>People paid</span><strong>{parsed.items.length}</strong></div>
            <div className="quote-row"><span>Subtotal</span><strong>{formatUSD(parsed.totalCents)}</strong></div>
            <div className="quote-row"><span>Network amount (once per batch)</span><strong>{formatUSD(NETWORK_FEE_CENTS)}</strong></div>
            <div className="quote-row total"><span>You pay</span><strong>{formatUSD(parsed.totalCents + NETWORK_FEE_CENTS)}</strong></div>
          </div>
          <button className="btn btn-gold btn-block" onClick={sendBatch} disabled={busy || !batchReady}>{busy ? "Paying batch…" : "Pay everyone"}</button>
          {!batchReady && <p className="small field-error">Review blocked: fix unknown or malformed rows first.</p>}
        </section>
      )}
    </div>
  );
}
