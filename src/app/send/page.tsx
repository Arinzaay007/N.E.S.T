import type { Metadata } from "next";
import SendClient from "@/components/SendClient";

export const metadata: Metadata = { title: "Send or run payroll" };

export default function SendPage() {
  return <div className="narrow page-stack"><SendClient /></div>;
}
