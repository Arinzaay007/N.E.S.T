"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";

export default function Header() {
  const [handle, setHandle] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHandle(data?.user?.handle ?? null))
      .catch(() => setHandle(null));
  }, []);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand"><Logo /></Link>
        <nav className="navlinks" aria-label="Primary">
          <Link href="/send">Send</Link>
          <Link href="/claim">Claim</Link>
          <Link href="/wallet">Wallet</Link>
          <Link href="/docs">How it works</Link>
          <Link href="/stats">Live stats</Link>
        </nav>
        {handle ? (
          <Link className="btn btn-primary nav-cta" href="/wallet">@{handle}</Link>
        ) : (
          <Link className="btn btn-primary nav-cta" href="/claim">Create wallet</Link>
        )}
      </div>
    </header>
  );
}
