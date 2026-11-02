import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createPayments, getUserById, type PaymentItemInput } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in.", 401);
    const body = await readJson<{ items: PaymentItemInput[]; paymentLinkId?: string; forceBatch?: boolean }>(request);
    if (!Array.isArray(body.items)) throw new AppError("Payment items are required.");
    const transfers = createPayments(user.id, body.items, { paymentLinkId: body.paymentLinkId, forceBatch: body.forceBatch });
    const fresh = getUserById(user.id);
    return NextResponse.json({ transfers, senderBalanceCents: fresh?.balanceCents ?? 0 }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
