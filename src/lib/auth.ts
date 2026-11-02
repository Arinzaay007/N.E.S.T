import { cookies } from "next/headers";
import { signToken, verifyToken } from "./crypto";
import { getUserById } from "./db";
import type { User } from "./types";

export const SESSION_COOKIE = "nest_session";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function makeSessionToken(userId: string): string {
  return signToken({ purpose: "session", userId, exp: Date.now() + WEEK });
}
export function makeClaimToken(email: string): string {
  return signToken({ purpose: "claim", email, exp: Date.now() + 15 * 60_000 });
}
export function readClaimToken(token: string): { email: string } | null {
  const parsed = verifyToken<{ email: string }>(token, "claim");
  return parsed?.email ? { email: parsed.email } : null;
}

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const parsed = verifyToken<{ userId: string }>(jar.get(SESSION_COOKIE)?.value, "session");
  if (!parsed?.userId) return null;
  return getUserById(parsed.userId);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: WEEK / 1000,
  secure: process.env.NODE_ENV === "production",
};
