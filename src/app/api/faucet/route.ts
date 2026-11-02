import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addDemoFunds, getUserById } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    if (process.env.NEST_DEMO_FAUCET === "false") throw new AppError("Demo funds are disabled.", 403);
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in.", 401);
    const transfer = addDemoFunds(user.id);
    return NextResponse.json({ transfer, balanceCents: getUserById(user.id)?.balanceCents ?? 0 }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
