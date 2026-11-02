import type { Metadata } from "next";
import WalletClient from "@/components/WalletClient";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <div className="page-stack"><WalletClient /></div>;
}
