"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Step = "email" | "code" | "claim";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export default function AuthForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handleState, setHandleState] = useState<{ text: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState("/wallet");

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) setNextPath(raw);
  }, []);

  useEffect(() => {
    if (step !== "claim" || !handle.trim()) { setHandleState(null); return; }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/handles/check?handle=${encodeURIComponent(handle)}`, { cache: "no-store" });
        const data = await res.json();
        if (!data.valid) setHandleState({ text: data.error, ok: false });
        else if (!data.available) setHandleState({ text: `@${data.handle} is taken.`, ok: false });
        else setHandleState({ text: `@${data.handle} is available.`, ok: true });
      } catch { setHandleState({ text: "Could not check that handle.", ok: false }); }
    }, 350);
    return () => window.clearTimeout(t);
  }, [handle, step]);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const data = await postJson("/api/auth/request", { email });
      setDemoCode(data.demoCode ?? null);
      if (data.demoCode) setCode(data.demoCode);
      setStep("code");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send code."); } finally { setBusy(false); }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const data = await postJson("/api/auth/verify", { email, code });
      if (data.needsClaim) { setClaimToken(data.claimToken); setStep("claim"); return; }
      router.push(nextPath); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not verify code."); } finally { setBusy(false); }
  }

  async function claim(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await postJson("/api/auth/claim", { claimToken, handle, displayName });
      router.push(nextPath); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not claim handle."); } finally { setBusy(false); }
  }

  return (
    <div className="card card-pad auth-card">
      <div className="steps" aria-label="Progress">
        <span className={step === "email" ? "step active" : "step"}>1 · Email</span>
        <span className={step === "code" ? "step active" : "step"}>2 · Code</span>
        <span className={step === "claim" ? "step active" : "step"}>3 · Handle</span>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {step === "email" && (
        <form onSubmit={requestCode} className="stack">
          <div>
            <h1 className="h2">Create your wallet or sign in</h1>
            <p className="muted">One email. One wallet. One permanent @handle. No seed phrase to write down.</p>
          </div>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="[email protected]" autoComplete="email" required />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
          <p className="small muted">Claim is sponsored once: NEST covers wallet activation for your first handle.</p>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verifyCode} className="stack">
          <div>
            <h2 className="h2">Check your email</h2>
            <p className="muted">We sent a 6-digit code to <strong>{email}</strong>.</p>
          </div>
          {demoCode && <div className="alert alert-demo">Demo mode: your code is <strong>{demoCode}</strong>. In production this arrives only by email.</div>}
          <label className="field">
            <span>6-digit code</span>
            <input className="input code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" required />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Continue"}</button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setStep("email")}>Use a different email</button>
        </form>
      )}

      {step === "claim" && (
        <form onSubmit={claim} className="stack">
          <div>
            <h2 className="h2">Claim your @handle</h2>
            <p className="muted">This becomes your public payable name, payment link and QR profile. Handles are permanent in v1.</p>
          </div>
          <label className="field">
            <span>Handle</span>
            <div className="handle-input"><span>@</span><input className="input" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/@/g, ""))} placeholder="yourshop" autoCapitalize="none" required /></div>
            {handleState && <span className={handleState.ok ? "field-ok" : "field-error"}>{handleState.text}</span>}
            <span className="small muted">3–20 lowercase letters, numbers or underscores.</span>
          </label>
          <label className="field">
            <span>Display name</span>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name or shop name" maxLength={60} />
          </label>
          <div className="alert alert-warn">
            <strong>Before you claim:</strong> your wallet key is encrypted on NEST servers so email can restore it. NEST can decrypt it. Read <Link href="/security">the security model</Link> before using serious money.
          </div>
          <button className="btn btn-gold btn-block" disabled={busy || handleState?.ok === false}>{busy ? "Creating wallet…" : "Create wallet & claim handle"}</button>
        </form>
      )}
    </div>
  );
}
