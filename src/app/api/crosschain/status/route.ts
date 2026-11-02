import { NextResponse } from "next/server";
import { getQuote, settleQuote } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { fetchOneClickStatus } from "@/lib/oneClick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const quoteId = new URL(request.url).searchParams.get("quoteId") ?? "";
    const quote = getQuote(quoteId);
    if (!quote) throw new AppError("Quote not found.", 404);
    if (quote.mode === "SIMULATED") {
      return NextResponse.json({ status: quote.status, quote }, { headers: { "Cache-Control": "no-store" } });
    }
    const status = await fetchOneClickStatus(quote.depositAddress);
    if (status === "SUCCESS") {
      const transfer = settleQuote(quote.id);
      return NextResponse.json({ status, transfer }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ status, quote }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
