import { NextRequest, NextResponse } from "next/server";

const LOCAL_AI_URL = process.env.LOCAL_AI_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const forwardForm = new FormData();
    forwardForm.append("file", file, (file as File).name || "document.pdf");

    const res = await fetch(`${LOCAL_AI_URL}/api/document/extract-text`, {
      method: "POST",
      body: forwardForm,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err || "Failed to extract text" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document extraction failed" },
      { status: 500 },
    );
  }
}
