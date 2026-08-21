"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  /** Either a direct src URL or a download endpoint (/api/download/...). */
  src: string;
  label?: string;
  className?: string;
}

export function AudioPlayer({ src, label = "Translated voice", className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | undefined>();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaying(false);
    setDuration(undefined);

    const onEnd = () => setPlaying(false);
    const onMeta = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("ended", onEnd);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("canplaythrough", onMeta);

    if (audio.readyState >= 1 && isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("canplaythrough", onMeta);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch((err) => {
          console.warn("Audio playback issue:", err);
          setPlaying(false);
        });
    }
  };

  const fmtTime = (s?: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border bg-muted/40 p-3", className)}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button
        type="button"
        size="icon"
        variant="default"
        className="h-9 w-9 rounded-full"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{fmtTime(duration)} · Audio</p>
      </div>
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <a href={src} download>
          <Download className="h-4 w-4" /> Save
        </a>
      </Button>
    </div>
  );
}
