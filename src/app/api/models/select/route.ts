import { NextResponse } from "next/server";
import { ModelSelector } from "@/lib/application/ModelSelector";
import type { EngineRole } from "@/lib/domain/models";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SelectBody {
  role: EngineRole;
  sourceLang?: string;
  targetLang?: string;
  durationSec?: number;
  textLength?: number;
  manualModelId?: string;
}

const VALID_ROLES: EngineRole[] = ["translation", "transcription", "tts", "llm"];

export async function POST(request: Request) {
  let body: SelectBody;
  try {
    body = (await request.json()) as SelectBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json<ApiError>(
      { error: `Role must be one of: ${VALID_ROLES.join(", ")}.` },
      { status: 400 },
    );
  }
  const selection = ModelSelector.select({
    role: body.role,
    sourceLang: body.sourceLang,
    targetLang: body.targetLang,
    durationSec: body.durationSec,
    textLength: body.textLength,
    manualModelId: body.manualModelId,
  });
  return NextResponse.json(selection);
}
