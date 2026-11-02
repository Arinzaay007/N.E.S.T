import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import PayForm from "@/components/PayForm";
import QrCode from "@/components/QrCode";
import { getPaymentLink, publicUser } from "@/lib/db";
import { formatUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "N";
}
async function originFromHeaders() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
function dateText(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = getPaymentLink(id);
  return { title: found ? `${found.link.title} · ${found.link.reference}` : "Invoice not found" };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = getPaymentLink(id);
  if (!found) notFound();
  const { link, owner } = found;
  const recipient = publicUser(owner);
  const invoiceUrl = `${await originFromHeaders()}/pay/${link.id}`;

  return (
    <div className="narrow stack page-stack">
      <section className="card profile-card">
        <div className="row space-between wrap">
          <div className="row gap">
            <span className="avatar large" style={{ background: recipient.avatarColor }}>{initials(recipient.displayName)}</span>
            <div><p className="eyebrow">Payment request</p><h1 className="h2">{link.title}</h1><p className="muted">For @{recipient.handle} · {recipient.displayName}</p></div>
          </div>
          <span className={link.status === "PAID" ? "badge badge-success" : "badge badge-warn"}>{link.status}</span>
        </div>

        <div className="invoice-hero">
          <span>Amount due</span><strong>{formatUSD(link.amountCents)}</strong><span>Reference {link.reference}</span>
        </div>

        <div className="quote-box">
          <div className="quote-row"><span>Created</span><strong>{dateText(link.createdAt)}</strong></div>
          {link.paidAt && <div className="quote-row"><span>Paid</span><strong>{dateText(link.paidAt)}</strong></div>}
          <div className="quote-row"><span>Settlement</span><strong>USDC on NEAR</strong></div>
          <div className="quote-row"><span>NEST fee</span><strong>$0.00</strong></div>
        </div>

        {link.status === "UNPAID" && (
          <div className="invoice-share">
            <QrCode value={invoiceUrl} size={132} />
            <div className="stack compact"><p className="muted">Share this exact invoice. Its amount cannot be changed on the payment form, so the merchant can reconcile {link.reference} cleanly.</p><CopyButton text={invoiceUrl} label="Copy invoice link" /></div>
          </div>
        )}

        <hr className="divider" />
        <PayForm recipient={recipient} presetAmountCents={link.amountCents} presetMemo={`${link.title} · ${link.reference}`} paymentLink={link} />
      </section>
    </div>
  );
}
