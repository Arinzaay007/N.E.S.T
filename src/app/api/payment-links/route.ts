import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createPaymentLink, getDashboard } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in.", 401);
    return NextResponse.json({ links: getDashboard(user.id)?.links ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in.", 401);
    const body = await readJson<{ title: string; amountCents: number; reference?: string }>(request);
    if (!Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 || body.amountCents > 100_000_000) {
      throw new AppError("Enter a valid invoice amount.");
    }
    const link = createPaymentLink(user.id, body.title ?? "Payment request", body.amountCents, body.reference);
    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
