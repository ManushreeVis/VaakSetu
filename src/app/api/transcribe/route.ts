import { NextRequest, NextResponse } from "next/server";

const LOCAL_AI_URL = process.env.LOCAL_AI_URL || "http://127.0.0.1:8000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const language = formData.get("language");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No audio file uploaded." }, { status: 400 });
    }

    const forwardForm = new FormData();
    forwardForm.append("file", file, (file as File).name || "audio.wav");
    if (language) {
      forwardForm.append("language", String(language));
    }

    const res = await fetch(`${LOCAL_AI_URL}/api/transcribe-file`, {
      method: "POST",
      body: forwardForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: errText || "Speech transcription failed on local AI engine." },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({
      text: data.full_text || data.text || "",
      language: data.language || language || "mr",
      duration: data.duration || 0,
      segments: data.segments || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to local AI transcription service.",
      },
      { status: 500 },
    );
  }
}
