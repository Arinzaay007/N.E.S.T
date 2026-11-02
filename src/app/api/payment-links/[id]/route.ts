import { NextResponse } from "next/server";
import { getPaymentLink, publicUser } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = getPaymentLink(id);
    if (!found) throw new AppError("Payment link not found.", 404);
    return NextResponse.json({ link: found.link, owner: publicUser(found.owner) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
