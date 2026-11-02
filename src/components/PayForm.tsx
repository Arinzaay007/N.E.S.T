"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CopyButton from "./CopyButton";
import { centsToInput, formatUSD, NETWORK_FEE_CENTS, parseAmountToCents } from "@/lib/money";
import { getRoute, SOURCE_ROUTES } from "@/lib/quotes";
import type { CrosschainQuote, PaymentLink, PublicUser } from "@/lib/types";

interface Me { id: string; handle: string; balanceCents: number }

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export default function PayForm({ recipient, presetAmountCents, presetMemo, paymentLink }: {
  recipient: PublicUser;
  presetAmountCents?: number;
  presetMemo?: string;
  paymentLink?: PaymentLink;
}) {
  const [amount, setAmount] = useState(presetAmountCents ? centsToInput(presetAmountCents) : "10.00");
  const [memo, setMemo] = useState(presetMemo ?? "");
  const [routeId, setRouteId] = useState("base");
  const [refundTo, setRefundTo] = useState("");
  const [mode, setMode] = useState<"nest" | "cross">("nest");
  const [me, setMe] = useState<Me | null>(null);
  const [quote, setQuote] = useState<CrosschainQuote | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => setMe(d?.user ?? null)).catch(() => setMe(null));
  }, []);

  const amountCents = useMemo(() => parseAmountToCents(amount), [amount]);
  const route = getRoute(routeId);
  const alreadyPaid = paymentLink?.status === "PAID";

  async function payWithNest() {
    if (!amountCents) return setError("Enter a valid dollar amount.");
    setBusy(true); setError(null); setReceipt(null);
    try {
      const data = await postJson("/api/transfers", {
        items: [{ handle: recipient.handle, amountCents, memo: memo || undefined }],
        paymentLinkId: paymentLink?.id,
      });
      setReceipt(data.transfers[0].receiptId);
      setMe((prev) => (prev ? { ...prev, balanceCents: data.senderBalanceCents } : prev));
    } catch (err) { setError(err instanceof Error ? err.message : "Payment failed."); } finally { setBusy(false); }
  }

  async function getQuote() {
    if (!amountCents) return setError("Enter a valid dollar amount.");
    setBusy(true); setError(null); setQuote(null); setStatusText(null); setReceipt(null);
    try {
      const data = await postJson("/api/crosschain/quote", {
        handle: recipient.handle, amountCents, routeId, memo: memo || undefined,
        refundTo: refundTo || undefined, paymentLinkId: paymentLink?.id,
      });
      setQuote(data.quote);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not get a quote."); } finally { setBusy(false); }
  }

  async function settleSimulated() {
    if (!quote) return;
    setBusy(true); setError(null);
    try {
      const data = await postJson("/api/crosschain/settle", { quoteId: quote.id });
      setReceipt(data.transfer.receiptId);
      setQuote({ ...quote, status: "SUCCESS", transferId: data.transfer.id });
    } catch (err) { setError(err instanceof Error ? err.message : "Settlement failed."); } finally { setBusy(false); }
  }

  async function checkLiveStatus() {
    if (!quote) return;
    setBusy(true); setError(null); setStatusText("Checking deposit status…");
    try {
      const res = await fetch(`/api/crosschain/status?quoteId=${encodeURIComponent(quote.id)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Status unavailable.");
      setStatusText(`Status: ${data.status}`);
      if (data.transfer) { setReceipt(data.transfer.receiptId); setQuote({ ...quote, status: "SUCCESS" }); }
    } catch (err) { setError(err instanceof Error ? err.message : "Status check failed."); } finally { setBusy(false); }
  }

  if (alreadyPaid) return <div className="alert alert-success"><strong>This invoice is paid.</strong><br />No more payment is needed.</div>;

  return (
    <div className="stack">
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {receipt && <div className="alert alert-success"><strong>Payment settled.</strong><br />Receipt <code>{receipt}</code><br />@{recipient.handle} now has the exact USDC amount on NEAR.</div>}

      <label className="field">
        <span>Amount for @{recipient.handle}</span>
        <div className="money-input"><span>$</span><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!!paymentLink} aria-label="Amount in dollars" /></div>
        {paymentLink ? <span className="small muted">Invoice amount is fixed so the merchant can reconcile it.</span> : <span className="small muted">The recipient gets this exact amount.</span>}
      </label>
      <label className="field">
        <span>Memo / reference <em className="muted">(optional)</em></span>
        <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Order #1042, October wages, thanks…" maxLength={140} />
      </label>

      <div className="segmented" role="tablist" aria-label="Payment source">
        <button type="button" className={mode === "nest" ? "seg active" : "seg"} onClick={() => setMode("nest")}>Pay with NEST</button>
        <button type="button" className={mode === "cross" ? "seg active" : "seg"} onClick={() => setMode("cross")}>Pay from another chain</button>
      </div>

      {mode === "nest" && (
        <div className="stack">
          {me ? (
            me.id === recipient.id ? (
              <div className="alert alert-warn">This is your public page. Share it with customers so they can pay you.</div>
            ) : (
              <>
                <div className="quote-box">
                  <div className="quote-row"><span>@{recipient.handle} receives</span><strong>{amountCents ? formatUSD(amountCents) : "—"}</strong></div>
                  <div className="quote-row"><span>NEST fee</span><strong>$0.00</strong></div>
                  <div className="quote-row"><span>Network amount</span><strong>{formatUSD(NETWORK_FEE_CENTS)}</strong></div>
                  <div className="quote-row total"><span>You pay</span><strong>{amountCents ? formatUSD(amountCents + NETWORK_FEE_CENTS) : "—"}</strong></div>
                  <p className="small muted">Your balance: {formatUSD(me.balanceCents)} · Settled as USDC on NEAR.</p>
                </div>
                <button className="btn btn-primary btn-block" onClick={payWithNest} disabled={busy || !amountCents}>{busy ? "Sending…" : `Pay @${recipient.handle}`}</button>
                {me.balanceCents < (amountCents ?? 0) + NETWORK_FEE_CENTS && <p className="small field-error">Your balance is too low. Open your wallet and use “Add $100 demo USDC” for testing.</p>}
              </>
            )
          ) : (
            <div className="card card-pad soft-card">
              <h3>Have a NEST wallet?</h3>
              <p className="muted">Sign in with email and pay in one tap. No wallet address to copy.</p>
              <Link className="btn btn-primary btn-block" href={`/claim?next=${encodeURIComponent(paymentLink ? `/pay/${paymentLink.id}` : `/@${recipient.handle}`)}`}>Sign in to pay</Link>
            </div>
          )}
        </div>
      )}

      {mode === "cross" && (
        <div className="stack">
          <label className="field">
            <span>Pay from</span>
            <select className="input" value={routeId} onChange={(e) => { setRouteId(e.target.value); setQuote(null); }}>
              {SOURCE_ROUTES.map((r) => <option key={r.id} value={r.id}>{r.chain} · {r.token}</option>)}
            </select>
            <span className="small muted">Any supported chain in; USDC on NEAR out. Routes must pass live quote checks before being called live.</span>
          </label>
          <label className="field">
            <span>Your refund address on {route.chain} <em className="muted">(needed for a live quote)</em></span>
            <input className="input mono" value={refundTo} onChange={(e) => setRefundTo(e.target.value)} placeholder="Your source-chain address" />
          </label>
          <button className="btn btn-primary btn-block" onClick={getQuote} disabled={busy || !amountCents}>{busy ? "Getting exact quote…" : "Show exact amount"}</button>

          {quote && (
            <div className="quote-box">
              <div className="row space-between"><strong>Exact-output quote</strong><span className={quote.mode === "ONECLICK" ? "badge badge-success" : "badge badge-warn"}>{quote.mode === "ONECLICK" ? "Live 1Click" : "Simulated demo"}</span></div>
              <div className="quote-row"><span>You send on {quote.sourceChain}</span><strong>{formatUSD(quote.amountInCents)} {quote.sourceToken}</strong></div>
              <div className="quote-row"><span>@{recipient.handle} receives</span><strong>{formatUSD(quote.amountCents)} USDC on NEAR</strong></div>
              <div className="quote-row"><span>NEST fee</span><strong>$0.00</strong></div>
              <div className="quote-row"><span>Quote expires</span><strong>{new Date(quote.expiresAt).toLocaleTimeString()}</strong></div>
              <label className="field"><span>Deposit address</span><div className="copy-row"><code className="address-box">{quote.depositAddress}</code><CopyButton text={quote.depositAddress} label="Copy" /></div></label>
              {quote.depositMemo && <p className="small"><strong>Required memo:</strong> <code>{quote.depositMemo}</code></p>}
              {quote.mode === "SIMULATED" ? (
                <>
                  <p className="alert alert-warn small">This is a simulated deposit address for judging the flow. Do not send real funds here. Enable 1Click plus a refund address for a live quote.</p>
                  <button className="btn btn-gold btn-block" onClick={settleSimulated} disabled={busy}>{busy ? "Settling…" : "Simulate deposit & settle"}</button>
                </>
              ) : (
                <>
                  <p className="small muted">Send the exact amount above from your own wallet, then check status. NEST never asks for a seed phrase.</p>
                  <button className="btn btn-secondary btn-block" onClick={checkLiveStatus} disabled={busy}>{busy ? "Checking…" : "I sent it — check status"}</button>
                  {statusText && <p className="small"><strong>{statusText}</strong></p>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
