/**
 * Supported media formats for BhashaSetu.
 * Video: MP4, MOV, AVI, WMV, MKV, FLV, WebM
 * Audio: MP3, WAV, AAC, M4A, FLAC, WMA, OGG
 */

export type MediaCategory = "video" | "audio";

export interface MediaFormat {
  ext: string;
  category: MediaCategory;
  mime: string;
  /** Friendly label */
  label: string;
}

export const VIDEO_FORMATS: MediaFormat[] = [
  { ext: "mp4", category: "video", mime: "video/mp4", label: "MP4" },
  { ext: "mov", category: "video", mime: "video/quicktime", label: "MOV" },
  { ext: "avi", category: "video", mime: "video/x-msvideo", label: "AVI" },
  { ext: "wmv", category: "video", mime: "video/x-ms-wmv", label: "WMV" },
  { ext: "mkv", category: "video", mime: "video/x-matroska", label: "MKV" },
  { ext: "flv", category: "video", mime: "video/x-flv", label: "FLV" },
  { ext: "webm", category: "video", mime: "video/webm", label: "WebM" },
];

export const AUDIO_FORMATS: MediaFormat[] = [
  { ext: "mp3", category: "audio", mime: "audio/mpeg", label: "MP3" },
  { ext: "wav", category: "audio", mime: "audio/wav", label: "WAV" },
  { ext: "aac", category: "audio", mime: "audio/aac", label: "AAC" },
  { ext: "m4a", category: "audio", mime: "audio/mp4", label: "M4A" },
  { ext: "flac", category: "audio", mime: "audio/flac", label: "FLAC" },
  { ext: "wma", category: "audio", mime: "audio/x-ms-wma", label: "WMA" },
  { ext: "ogg", category: "audio", mime: "audio/ogg", label: "OGG" },
];

export const ALL_MEDIA_FORMATS: MediaFormat[] = [...VIDEO_FORMATS, ...AUDIO_FORMATS];

export const ACCEPTED_EXTENSIONS = ALL_MEDIA_FORMATS.map((f) => `.${f.ext}`);

export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

/** Max upload size (500 MB) — on-prem deployments may raise this. */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export const getFormatByExt = (ext: string): MediaFormat | undefined => {
  const normalized = ext.replace(/^\./, "").toLowerCase();
  return ALL_MEDIA_FORMATS.find((f) => f.ext === normalized);
};

export const getCategory = (ext: string): MediaCategory | undefined =>
  getFormatByExt(ext)?.category;

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};
