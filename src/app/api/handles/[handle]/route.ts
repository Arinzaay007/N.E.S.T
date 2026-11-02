import { NextResponse } from "next/server";
import { getUserByHandle, publicUser } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const user = getUserByHandle(decodeURIComponent(handle));
    if (!user) throw new AppError("User not found.", 404);
    return NextResponse.json({ user: publicUser(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
