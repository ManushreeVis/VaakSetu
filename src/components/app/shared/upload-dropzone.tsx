"use client";

import { UploadCloud, FileVideo, FileAudio } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ACCEPT_ATTR } from "@/lib/domain/media-formats";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  /** Optional label override. */
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function UploadDropzone({ onFile, label, className, disabled }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !files.length) return;
      onFile(files[0]);
    },
    [onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload media file"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        "cursor-pointer hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging ? "border-primary bg-primary/10" : "border-border",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
        <UploadCloud className="h-7 w-7" />
      </div>
      <div>
        <p className="font-medium">
          {label ?? "Drop a video or audio file here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Video: MP4 · MOV · AVI · WMV · MKV · FLV · WebM
        </p>
        <p className="text-xs text-muted-foreground">
          Audio: MP3 · WAV · AAC · M4A · FLAC · WMA · OGG
        </p>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><FileVideo className="h-3.5 w-3.5" /> Video</span>
        <span className="flex items-center gap-1"><FileAudio className="h-3.5 w-3.5" /> Audio</span>
      </div>
    </div>
  );
}
