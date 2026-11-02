import { NextResponse } from "next/server";
import { makeClaimToken, makeSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { consumeOtp, getUserByEmail, publicUser } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isEmail, normalizeEmail } from "@/lib/handle";
import { errorResponse, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { email, code } = await readJson<{ email: string; code: string }>(request);
    if (!email || !isEmail(email) || !code) throw new AppError("Enter your email and 6-digit code.");
    const normalized = normalizeEmail(email);
    if (!consumeOtp(normalized, code)) throw new AppError("That code is wrong or expired. Request a new one.");
    const user = getUserByEmail(normalized);
    if (!user) return NextResponse.json({ needsClaim: true, claimToken: makeClaimToken(normalized) });
    const res = NextResponse.json({ authenticated: true, user: publicUser(user) });
    res.cookies.set(SESSION_COOKIE, makeSessionToken(user.id), sessionCookieOptions);
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
