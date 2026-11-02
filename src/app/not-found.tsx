import Link from "next/link";

export default function NotFound() {
  return (
    <div className="narrow card card-pad stack center page-stack">
      <p className="eyebrow">404</p>
      <h1 className="h2">That nest is empty</h1>
      <p className="muted">The handle, invoice or page you opened does not exist. Check the spelling — NEST never sends money to an unknown name.</p>
      <div className="row wrap center-row"><Link className="btn btn-primary" href="/">Go home</Link><Link className="btn btn-secondary" href="/claim">Claim this handle</Link></div>
    </div>
  );
}
