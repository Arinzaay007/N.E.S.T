import { NextResponse } from "next/server";
import { randomId } from "@/lib/crypto";
import { getPaymentLink, getUserByHandle, saveQuote } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse, readJson } from "@/lib/http";
import { createCrosschainQuote } from "@/lib/oneClick";
import { getRoute } from "@/lib/quotes";
import type { CrosschainQuote } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson<{
      handle: string; amountCents: number; routeId: string; memo?: string; refundTo?: string; paymentLinkId?: string;
    }>(request);
    if (!Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 || body.amountCents > 100_000_000) {
      throw new AppError("Enter a valid amount.");
    }
    if (body.paymentLinkId) {
      const found = getPaymentLink(body.paymentLinkId);
      if (!found) throw new AppError("Payment link not found.", 404);
      if (found.link.status === "PAID") throw new AppError("This invoice has already been paid.", 409);
      if (found.owner.handle !== body.handle || found.link.amountCents !== body.amountCents) {
        throw new AppError("Invoice amount or recipient does not match.");
      }
    }
    const recipient = getUserByHandle(body.handle ?? "");
    if (!recipient) throw new AppError("User not found.", 404);
    const route = getRoute(body.routeId ?? "base");
    const quoteId = randomId("quote");
    const result = await createCrosschainQuote({
      routeId: route.id,
      sourceToken: route.token,
      amountCents: body.amountCents,
      recipientAccountId: recipient.accountId,
      refundTo: body.refundTo,
      quoteSeed: `${quoteId}:${Date.now()}`,
    });
    const quote: CrosschainQuote = {
      id: quoteId,
      mode: result.mode,
      toUserId: recipient.id,
      toHandle: recipient.handle,
      paymentLinkId: body.paymentLinkId,
      memo: body.memo?.trim().slice(0, 140) || undefined,
      amountCents: body.amountCents,
      amountInCents: result.amountInCents,
      sourceChain: route.chain,
      sourceToken: route.token,
      depositAddress: result.depositAddress,
      depositMemo: result.depositMemo,
      refundTo: body.refundTo,
      expiresAt: result.expiresAt,
      status: "PENDING_DEPOSIT",
      createdAt: new Date().toISOString(),
    };
    saveQuote(quote);
    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
