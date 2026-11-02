import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Security model" };

export default function SecurityPage() {
  return (
    <div className="narrow stack page-stack">
      <header className="page-intro">
        <p className="eyebrow">Plain-English security</p>
        <h1>What NEST can — and cannot — do</h1>
        <p className="lead">NEST is designed for people who know email better than seed phrases. That convenience has a real custody trade-off, and we state it before anyone claims a handle.</p>
      </header>

      <section className="alert alert-warn security-disclosure">
        <strong>Required disclosure:</strong> N.E.S.T Wallet keys are encrypted on our servers so the same email restores the same wallet. We can decrypt them. Protect your email. Lose access to your email and don’t export your recovery phrase, and your funds may be gone.
      </section>

      <section className="grid-2">
        <article className="card card-pad stack">
          <h2 className="h3">✓ What protects you</h2>
          <ul className="check-list">
            <li>Wallet keys are AES-256-GCM encrypted at rest; plaintext keys are never returned by normal APIs.</li>
            <li>Email codes are hashed, expire in 10 minutes, and stop after repeated wrong attempts.</li>
            <li>Sessions are signed, HTTP-only cookies scoped to this app.</li>
            <li>Unknown @handles are blocked before a payment can be created.</li>
            <li>Invoice amount and recipient are checked again server-side before settlement.</li>
            <li>Cross-chain quotes are exact-output, so the recipient amount is not quietly reduced by a platform cut.</li>
          </ul>
        </article>
        <article className="card card-pad stack">
          <h2 className="h3">⚠ What can still hurt you</h2>
          <ul className="warning-list">
            <li>If someone controls your email inbox, they may be able to restore your wallet.</li>
            <li>If both the key database and encryption secret are compromised, keys could be decrypted.</li>
            <li>If you lose email access and have not exported recovery material, recovery may be impossible.</li>
            <li>A payment to the wrong valid handle can still be final. Always confirm the display name, handle and amount.</li>
            <li>Cross-chain deposits sent to an expired or wrong quote address may be delayed, refunded, or lost depending on the route.</li>
          </ul>
        </article>
      </section>

      <section className="card card-pad stack">
        <h2 className="h3">Prototype status — Bit 1</h2>
        <p>This build uses a local, judge-runnable ledger in <code>.data/</code> and real ed25519 key generation with encrypted storage. Cross-chain quotes are <strong>simulated unless explicitly labelled “Live 1Click.”</strong> Do not send real funds to simulated deposit addresses.</p>
        <p>The production path replaces the local ledger with the NEAR handle registry, NEP-141 USDC transfers, an indexer, a hardened signer service and NEP-366 delegate submission. A route is only promoted after live asset discovery and dry exact-output quote checks.</p>
      </section>

      <section className="card card-pad stack">
        <h2 className="h3">Required before serious mainnet custody</h2>
        <ul className="check-list">
          <li>Recovery/key export with fresh email re-authentication and a cooling-off warning.</li>
          <li>Device/session list and one-tap revocation.</li>
          <li>Step-up authentication for export, large payments and email changes.</li>
          <li>Signer isolation, KMS/HSM-backed key encryption, audit logs and rate limits.</li>
          <li>Sponsor-wallet caps, abuse monitoring and periodic USDC→NEAR refill controls.</li>
          <li>Independent contract review and production incident runbooks.</li>
        </ul>
        <div className="row wrap"><Link className="btn btn-primary" href="/docs">How NEST works</Link><Link className="btn btn-secondary" href="/wallet">Open wallet security</Link></div>
      </section>
    </div>
  );
}
