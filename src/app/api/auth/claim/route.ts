import { NextResponse } from "next/server";
import { makeSessionToken, readClaimToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { createUser, publicUser } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { validateHandle } from "@/lib/handle";
import { errorResponse, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { claimToken, handle, displayName } = await readJson<{ claimToken: string; handle: string; displayName: string }>(request);
    const claim = readClaimToken(claimToken ?? "");
    if (!claim) throw new AppError("Your verified-email session expired. Request a new code.", 401);
    const valid = validateHandle(handle ?? "");
    if (!valid.handle) throw new AppError(valid.error ?? "Invalid handle.");
    const user = createUser(claim.email, valid.handle, displayName ?? valid.handle);
    const res = NextResponse.json({ authenticated: true, user: publicUser(user) }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, makeSessionToken(user.id), sessionCookieOptions);
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
