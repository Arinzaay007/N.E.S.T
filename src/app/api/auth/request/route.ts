import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { saveOtp } from "@/lib/db";
import { isEmail, normalizeEmail } from "@/lib/handle";
import { errorResponse, readJson } from "@/lib/http";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

async function sendEmail(email: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "[email protected]",
        to: email,
        subject: "Your NEST sign-in code",
        text: `Your NEST code is ${code}. It expires in 10 minutes.`,
      }),
    });
  } catch {
    // OTP remains valid; delivery errors are surfaced operationally, not to attackers.
  }
}

export async function POST(request: Request) {
  try {
    const { email } = await readJson<{ email: string }>(request);
    if (!email || !isEmail(email)) throw new AppError("Enter a valid email address.");
    const normalized = normalizeEmail(email);
    const code = String(randomInt(100000, 1000000));
    saveOtp(normalized, code);
    await sendEmail(normalized, code);
    const demo = process.env.NEST_DEMO_OTP !== "false";
    return NextResponse.json({ ok: true, demoCode: demo ? code : undefined });
  } catch (error) {
    return errorResponse(error);
  }
}
