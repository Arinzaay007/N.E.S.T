import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NEST — Bring the boring money onchain", template: "%s · NEST" },
  description: "N.E.S.T (NEAR Enabled Settlement & Transfers) lets people pay a @handle for invoices, merchant payments, tips and payroll. Many chains in, one USDC balance on NEAR.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="main container">{children}</main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <div>
              <Logo />
              <p className="small muted">N.E.S.T — NEAR Enabled Settlement & Transfers.<br />Where money from every chain comes home.</p>
            </div>
            <nav className="footer-links" aria-label="Footer">
              <Link href="/docs">How it works</Link>
              <Link href="/security">Security</Link>
              <Link href="/stats">Live stats</Link>
              <Link href="/claim">Claim a handle</Link>
              <Link href="/send">Send / payroll</Link>
            </nav>
            <p className="small muted footer-note">Bit 1 prototype: simulated quotes are clearly labelled. Never send real funds to a simulated deposit address.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
