import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Claim your handle" };

export default function ClaimPage() {
  return (
    <div className="narrow stack page-stack">
      <div className="page-intro center">
        <p className="eyebrow">One email · one wallet · one name</p>
        <p className="lead">Your @handle becomes the name customers, clients and teammates pay.</p>
      </div>
      <AuthForm />
      <div className="mini-benefits">
        <span>First claim sponsored</span><span>Permanent v1 handle</span><span>Same wallet on any device</span>
      </div>
    </div>
  );
}
