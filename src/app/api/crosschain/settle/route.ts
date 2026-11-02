import { NextResponse } from "next/server";
import { getQuote, settleQuote } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { quoteId } = await readJson<{ quoteId: string }>(request);
    const quote = getQuote(quoteId ?? "");
    if (!quote) throw new AppError("Quote not found.", 404);
    if (quote.mode === "ONECLICK") throw new AppError("Live quotes settle only after the 1Click status reaches SUCCESS.", 409);
    const transfer = settleQuote(quoteId);
    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
