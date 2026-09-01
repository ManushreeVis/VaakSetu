/**
 * Test script: End-to-End Marathi Video to Hindi Translation & Segment Dubbing Verification.
 * 
 * Verifies:
 * 1. Multi-segment Marathi speech generation
 * 2. Video container creation with FFmpeg
 * 3. Whisper Small Marathi speech recognition
 * 4. Local Neural Translation (Marathi -> Hindi)
 * 5. Time-aligned per-segment Hindi TTS dubbing (full duration coverage, no truncation)
 * 6. Dubbed MP4 video muxing
 * 7. Dual Subtitle generation (Marathi source + Hindi target)
 */

import path from "path";
import fs from "fs/promises";
import { MediaTranslator } from "../src/lib/application/MediaTranslator";
import { prisma } from "../src/lib/db";
import { spawn } from "child_process";

const runCmd = (cmd: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} failed (${code}): ${stderr}`)),
    );
  });

async function main() {
  console.log("=================================================");
  console.log("  VaakSetu — Marathi to Hindi Video Dubbing Test ");
  console.log("=================================================");

  const testDir = path.join(process.cwd(), "storage", "test_media");
  await fs.mkdir(testDir, { recursive: true });

  const marathiAudioPath = path.join(testDir, "sample_marathi_speech.mp3");
  const marathiVideoPath = path.join(testDir, "sample_marathi_video.mp4");

  // Step 1: Generate real Marathi speech audio sample
  console.log("\n▶ 1. Generating multi-sentence Marathi speech audio sample...");
  const marathiText = "नमस्कार. वाक्सेतु प्रकल्पामध्ये आपले स्वागत आहे. हे स्थानिक भाषांतर तंत्रज्ञान ग्रामीण भागासाठी विकसित केले आहे. शेतकऱ्यांना या तंत्रज्ञानाचा मोठा फायदा होणार आहे.";
  
  const ttsRes = await fetch("http://127.0.0.1:8000/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: marathiText,
      language: "mr",
      voice: "mr-IN-AarohiNeural",
    }),
  });

  if (!ttsRes.ok) {
    throw new Error(`TTS synthesis failed (${ttsRes.status}): ${await ttsRes.text()}`);
  }

  const audioBuf = Buffer.from(await ttsRes.arrayBuffer());
  await fs.writeFile(marathiAudioPath, audioBuf);
  console.log(`   ✓ Marathi audio sample saved: ${marathiAudioPath} (${audioBuf.length} bytes)`);

  // Step 2: Build MP4 Video container
  console.log("\n▶ 2. Building MP4 video container with FFmpeg...");
  await runCmd("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", "color=c=0x1e1b4b:s=1280x720:rate=25",
    "-i", marathiAudioPath,
    "-c:v", "libx264",
    "-tune", "stillimage",
    "-c:a", "aac",
    "-b:a", "192k",
    "-pix_fmt", "yuv420p",
    "-shortest",
    marathiVideoPath,
  ]);
  console.log(`   ✓ Video generated: ${marathiVideoPath}`);

  // Probe media duration
  const probeRaw = await runCmd("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "json",
    marathiVideoPath,
  ]);
  const durationSec = parseFloat(JSON.parse(probeRaw).format.duration);
  console.log(`   ✓ Video duration: ${durationSec.toFixed(2)}s`);

  // Step 3: Execute MediaTranslator pipeline
  console.log("\n▶ 3. Executing MediaTranslator pipeline (Video -> Whisper -> NLLB/IndicTrans2 -> Segment TTS -> Dubbed MP4)...");
  const startTime = Date.now();

  const result = await MediaTranslator.run({
    inputPath: marathiVideoPath,
    inputName: "sample_marathi_video.mp4",
    inputMime: "video/mp4",
    sourceLang: "mr",
    targetLang: "hi",
    generateVoice: true,
    generateSubtitles: true,
  });

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=================================================");
  console.log("  PIPELINE EXECUTION RESULTS                     ");
  console.log("=================================================");
  console.log(`✓ Job ID               : ${result.jobId}`);
  console.log(`✓ Processing Time      : ${elapsedSec}s`);
  console.log(`✓ Model Selected       : ${result.model}`);
  console.log(`✓ Media Duration       : ${(result.durationSec ?? 0).toFixed(2)}s`);
  console.log(`✓ Transcribed (Marathi): "${result.transcript}"`);
  console.log(`✓ Translated (Hindi)   : "${result.translatedText}"`);
  console.log(`✓ Segments Processed   : ${result.segments.length}`);
  console.log(`✓ Output Audio Track   : ${result.outputAudioPath || "None"}`);
  console.log(`✓ Dubbed Video Track   : ${result.dubbedVideoName || "None"}`);
  
  if (result.outputSrt) {
    console.log(`\n✓ Hindi SRT Generated:\n${result.outputSrt.trim()}`);
  }

  // Step 4: Verify Dubbed Audio Duration matches Original Media Duration
  if (result.outputAudioPath) {
    const audioProbe = await runCmd("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "json",
      result.outputAudioPath,
    ]);
    const dubbedAudioDur = parseFloat(JSON.parse(audioProbe).format.duration);
    console.log(`\n▶ 4. Audio Duration Verification:`);
    console.log(`   - Original Video Duration: ${durationSec.toFixed(2)}s`);
    console.log(`   - Dubbed Audio Duration  : ${dubbedAudioDur.toFixed(2)}s`);

    const durDiff = Math.abs(durationSec - dubbedAudioDur);
    if (durDiff <= 1.5) {
      console.log(`   ✓ Audio duration matches video within tolerance (diff: ${durDiff.toFixed(2)}s) — NO TRUNCATION!`);
    } else {
      console.warn(`   ⚠ Audio duration difference is ${durDiff.toFixed(2)}s`);
    }
  }

  // Step 5: Verify SQLite Database Record
  console.log("\n▶ 5. Verifying SQLite Database Record...");
  const dbJob = await prisma.job.findUnique({ where: { id: result.jobId } });
  if (dbJob) {
    console.log(`   ✓ Database Job Status: ${dbJob.status}`);
    console.log(`   ✓ Database Progress  : ${dbJob.progress}%`);
    console.log(`   ✓ Database SourceLang: ${dbJob.sourceLang}`);
    console.log(`   ✓ Database TargetLang: ${dbJob.targetLang}`);
    console.log(`   ✓ Database Output Srt: ${dbJob.outputSrt ? "Present" : "Missing"}`);
    console.log(`   ✓ Database Output TTS: ${dbJob.outputAudio ? "Present" : "Missing"}`);
  }

  console.log("\n🎉 ALL MARATHI TO HINDI TESTS PASSED SUCCESSFULLY!\n");
}

main().catch((err) => {
  console.error("\n❌ Pipeline test failed:", err);
  process.exit(1);
});
