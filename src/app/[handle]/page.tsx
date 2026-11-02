import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import PayForm from "@/components/PayForm";
import QrCode from "@/components/QrCode";
import { getUserByHandle, publicUser } from "@/lib/db";
import { parseAmountToCents } from "@/lib/money";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "N";
}
async function originFromHeaders() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const user = getUserByHandle(decodeURIComponent(handle));
  return { title: user ? `Pay @${user.handle}` : "Handle not found" };
}

export default async function HandlePage({ params, searchParams }: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ amount?: string | string[]; memo?: string | string[] }>;
}) {
  const { handle: rawHandle } = await params;
  const query = await searchParams;
  const user = getUserByHandle(decodeURIComponent(rawHandle));
  if (!user) notFound();
  const recipient = publicUser(user);
  const amount = first(query.amount);
  const memo = first(query.memo)?.slice(0, 140);
  const presetAmountCents = amount ? parseAmountToCents(amount) ?? undefined : undefined;
  const profileUrl = `${await originFromHeaders()}/@${recipient.handle}`;

  return (
    <div className="narrow stack page-stack">
      <section className="card profile-card">
        <div className="profile-head">
          <span className="avatar xlarge" style={{ background: recipient.avatarColor }}>{initials(recipient.displayName)}</span>
          <div>
            <p className="eyebrow">Pay securely by name</p>
            <h1>{recipient.displayName}</h1>
            <p className="handle-title">@{recipient.handle}</p>
            <p className="small muted">On NEST since {new Date(recipient.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })} · Receives USDC on NEAR</p>
          </div>
          <span className="badge badge-success">Verified handle</span>
        </div>

        <div className="profile-pay-grid">
          <div className="qr-panel">
            <QrCode value={profileUrl} size={176} />
            <p className="small muted">Scan to open this payment page. Always confirm the name and amount before paying.</p>
            <CopyButton text={profileUrl} label="Copy payment link" />
          </div>
          <PayForm recipient={recipient} presetAmountCents={presetAmountCents} presetMemo={memo} />
        </div>
      </section>

      <section className="card card-pad soft-card stack">
        <h2 className="h3">Why the amount stays exact</h2>
        <p className="muted">NEST uses exact-output quoting for cross-chain payments: routing cost is shown to the sender on top, the platform fee is 0%, and @{recipient.handle} receives the full requested USDC amount on NEAR.</p>
        <details>
          <summary>Technical account details</summary>
          <p className="small muted">NEAR implicit account ID</p>
          <code className="address-box">{recipient.accountId}</code>
        </details>
      </section>
    </div>
  );
}
