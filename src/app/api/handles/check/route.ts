import { NextResponse } from "next/server";
import { getUserByHandle, publicUser } from "@/lib/db";
import { validateHandle } from "@/lib/handle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("handle") ?? "";
  const valid = validateHandle(raw);
  if (!valid.handle) return NextResponse.json({ valid: false, error: valid.error, available: false }, { headers: { "Cache-Control": "no-store" } });
  const user = getUserByHandle(valid.handle);
  return NextResponse.json(
    { valid: true, handle: valid.handle, available: !user, user: user ? publicUser(user) : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
