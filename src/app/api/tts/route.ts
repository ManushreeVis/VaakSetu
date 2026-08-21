import { NextResponse } from "next/server";
import { aiEngines } from "@/lib/infrastructure/ai/zai-adapter";
import { saveOutput } from "@/lib/infrastructure/storage/file-storage";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TtsBody {
  text: string;
  language: string;
  speed?: number;
}

export async function POST(request: Request) {
  let body: TtsBody;
  try {
    body = (await request.json()) as TtsBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.text?.trim()) {
    return NextResponse.json<ApiError>({ error: "Text is required." }, { status: 400 });
  }
  try {
    const audio = await aiEngines.tts.synthesize(body.text, body.language ?? "en", {
      speed: body.speed,
    });
    const outPath = await saveOutput(`tts-${Date.now()}`, `speech.mp3`, audio);
    const basename = outPath.split("/").slice(-2).join("/");
    return NextResponse.json({ path: outPath, ref: basename, size: audio.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
