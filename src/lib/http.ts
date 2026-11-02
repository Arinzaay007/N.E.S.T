import { NextResponse } from "next/server";
import { AppError } from "./errors";

export function errorResponse(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("Invalid JSON body.");
  }
}
