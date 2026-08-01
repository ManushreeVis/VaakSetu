import { NextResponse } from "next/server";
import { SubtitleConverter } from "@/lib/application/SubtitleConverter";
import type { SubtitleFormat } from "@/lib/utils/subtitles";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ConvertBody {
  content: string;
  to: SubtitleFormat;
}

const VALID: SubtitleFormat[] = ["srt", "vtt", "txt", "json"];

export async function POST(request: Request) {
  let body: ConvertBody;
  try {
    body = (await request.json()) as ConvertBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return NextResponse.json<ApiError>({ error: "Subtitle content is required." }, { status: 400 });
  }
  if (!VALID.includes(body.to)) {
    return NextResponse.json<ApiError>(
      { error: `Target format must be one of: ${VALID.join(", ")}.` },
      { status: 400 },
    );
  }
  try {
    const result = await SubtitleConverter.run({ content: body.content, to: body.to });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conversion failed.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
