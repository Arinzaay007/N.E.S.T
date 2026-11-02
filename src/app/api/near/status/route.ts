import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { validateHandle } from "@/lib/handle";
import { errorResponse } from "@/lib/http";
import { getNearReadiness, isValidNearAccountId } from "@/lib/near";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, read-only chain readiness endpoint.
 * It never signs, deposits storage, or transfers value.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawHandle = searchParams.get("handle") ?? undefined;
    const accountId = searchParams.get("accountId")?.trim().toLowerCase() || undefined;

    let handle: string | undefined;
    if (rawHandle) {
      const valid = validateHandle(rawHandle);
      if (!valid.handle) throw new AppError(valid.error ?? "Invalid handle.");
      handle = valid.handle;
    }
    if (accountId && !isValidNearAccountId(accountId)) throw new AppError("Invalid NEAR account ID.");

    const readiness = await getNearReadiness({ handle, accountId });
    return NextResponse.json(readiness, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
