import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDashboard } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in.", 401);
    const dashboard = getDashboard(user.id);
    if (!dashboard) throw new AppError("Please sign in.", 401);
    return NextResponse.json(dashboard, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
