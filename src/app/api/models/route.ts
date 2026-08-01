import { NextResponse } from "next/server";
import { MODEL_REGISTRY } from "@/lib/domain/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ models: MODEL_REGISTRY });
}
