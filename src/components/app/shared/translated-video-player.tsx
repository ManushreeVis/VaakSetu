"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Captions,
  Settings,
  Download,
  Film,
  Music,
  Check,
  RotateCcw,
  Sparkles,
  ListTree,
  Radio,
  Layers,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { languageLabel, languageNative } from "@/lib/domain/languages";

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

interface TranslatedVideoPlayerProps {
  jobId: string;
  sourceLang: string;
  targetLang: string;
  inputVideoName?: string;
  dubbedVideoName?: string;
  audioName?: string;
  outputSrt?: string;
  outputVtt?: string;
  translatedSegments: SubtitleSegment[];
  sourceSegments?: SubtitleSegment[];
  transcriptText?: string;
  translatedText?: string;
  durationSec?: number;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export function TranslatedVideoPlayer({
  jobId,
  sourceLang,
  targetLang,
  inputVideoName,
  dubbedVideoName,
  audioName,
  outputSrt,
  outputVtt,
  translatedSegments,
  sourceSegments = [],
  transcriptText,
  translatedText,
  durationSec,
}: TranslatedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // URLs
  const originalVideoUrl = inputVideoName ? `/api/download/${jobId}/${inputVideoName}` : null;
  const dubbedVideoUrl = dubbedVideoName ? `/api/download/${jobId}/${dubbedVideoName}` : null;
  const separateAudioUrl = audioName ? `/api/download/${jobId}/${audioName}` : null;

  // Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // YouTube-style Features: Audio Track & Captions Mode
  // "original" | "dubbed_stream" | "dubbed_synced"
  const [audioTrack, setAudioTrack] = useState<"original" | "dubbed">("dubbed");
  // "off" | "target" | "source"
  const [captionMode, setCaptionMode] = useState<"off" | "target" | "source">("target");
  const [activeTab, setActiveTab] = useState<"transcript" | "downloads">("transcript");
  const [burningCaptions, setBurningCaptions] = useState(false);

  // Determine current active video source
  const currentVideoSrc = useMemo(() => {
    if (audioTrack === "dubbed" && dubbedVideoUrl) {
      return dubbedVideoUrl;
    }
    return originalVideoUrl || dubbedVideoUrl || "";
  }, [audioTrack, dubbedVideoUrl, originalVideoUrl]);

  // Current active subtitle text
  const activeSubtitle = useMemo(() => {
    if (captionMode === "off") return null;
    const segs = captionMode === "target" ? translatedSegments : sourceSegments;
    const match = segs.find((s) => currentTime >= s.start && currentTime <= s.end);
    return match ? match.text : null;
  }, [captionMode, currentTime, translatedSegments, sourceSegments]);

  // Sync Video & Audio Time
  const onTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (values: number[]) => {
    const target = values[0];
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleVolumeChange = (values: number[]) => {
    const v = values[0];
    setVolume(v);
    setIsMuted(v === 0);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume || 1.0;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const seekToSegment = (startSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startSec;
      setCurrentTime(startSec);
      if (!isPlaying) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // Switch Audio Track
  const handleAudioTrackChange = (track: "original" | "dubbed") => {
    const previousTime = videoRef.current ? videoRef.current.currentTime : 0;
    const wasPlaying = isPlaying;
    setAudioTrack(track);

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = previousTime;
        if (wasPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
    }, 100);

    toast.info(
      track === "dubbed"
        ? `Switched to Dubbed Voice (${languageNative(targetLang)})`
        : `Switched to Original Audio (${languageNative(sourceLang)})`
    );
  };

  // Burn hardcoded captions
  const handleBurnCaptions = async () => {
    setBurningCaptions(true);
    try {
      const res = await fetch(`/api/media/${jobId}/burn`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to burn captions.");
      const downloadUrl = `/api/download/${jobId}/${data.downloadName}`;
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = data.downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Burned subtitles video ready & downloaded!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Burn failed.");
    } finally {
      setBurningCaptions(false);
    }
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Main Player & Interactive Sidebar Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Video Player Container (7 or 8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            className="group relative flex aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
          >
            {/* Video Element */}
            {currentVideoSrc ? (
              <video
                ref={videoRef}
                src={currentVideoSrc}
                className="h-full w-full object-contain cursor-pointer"
                onClick={togglePlay}
                onTimeUpdate={onTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setDuration(videoRef.current.duration);
                  }
                }}
                playsInline
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <p>No video available to stream</p>
              </div>
            )}

            {/* YouTube-style Closed Captions (CC) Overlay */}
            {activeSubtitle && (
              <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-20 flex justify-center px-6">
                <div className="rounded-lg bg-black/85 px-4 py-2 text-center text-white backdrop-blur-md shadow-lg border border-white/10 max-w-2xl">
                  <p className="text-sm sm:text-base font-medium tracking-wide drop-shadow-md leading-relaxed">
                    {activeSubtitle}
                  </p>
                </div>
              </div>
            )}

            {/* Top Bar Indicators (YouTube-style Track Badge) */}
            <div
              className={`absolute top-4 left-4 right-4 z-30 flex items-center justify-between transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-black/60 text-white backdrop-blur-md border border-white/10 gap-1.5 px-3 py-1 text-xs"
                >
                  <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                  {audioTrack === "dubbed"
                    ? `Dubbed Audio · ${languageNative(targetLang)}`
                    : `Original Audio · ${languageNative(sourceLang)}`}
                </Badge>

                {captionMode !== "off" && (
                  <Badge
                    variant="secondary"
                    className="bg-black/60 text-amber-300 backdrop-blur-md border border-white/10 gap-1 px-2.5 py-1 text-[11px]"
                  >
                    <Captions className="h-3 w-3" />
                    CC {captionMode === "target" ? languageLabel(targetLang) : languageLabel(sourceLang)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-primary/20 text-primary-foreground border-primary/30 text-xs backdrop-blur-md"
                >
                  <Sparkles className="h-3 w-3 mr-1 text-primary" />
                  IndicTrans2 + Whisper
                </Badge>
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* Timeline Scrubber */}
              <div className="mb-3 px-1">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />
              </div>

              {/* Control Buttons Row */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  {/* Play / Pause */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="h-9 w-9 text-white hover:bg-white/20 rounded-full"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                  </Button>

                  {/* Volume Control */}
                  <div className="flex items-center gap-2 group/vol">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMute}
                      className="h-9 w-9 text-white hover:bg-white/20 rounded-full"
                      aria-label="Mute"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-5 w-5 text-red-400" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </Button>
                    <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.05}
                        onValueChange={handleVolumeChange}
                        className="w-20"
                      />
                    </div>
                  </div>

                  {/* Time Display */}
                  <span className="text-xs font-mono text-white/90 select-none">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right Side Options: Audio Track, Subtitles CC, Settings, Fullscreen */}
                <div className="flex items-center gap-2">
                  {/* YouTube Multi-Audio Track Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-white hover:bg-white/20 rounded-lg px-2.5"
                      >
                        <Music className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Audio Track</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-zinc-950/95 text-white border-zinc-800">
                      <DropdownMenuLabel className="text-xs text-zinc-400">Audio Track (Dubbing)</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem
                        onClick={() => handleAudioTrackChange("dubbed")}
                        className="flex items-center justify-between cursor-pointer text-xs"
                      >
                        <span>Dubbed ({languageNative(targetLang)})</span>
                        {audioTrack === "dubbed" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleAudioTrackChange("original")}
                        className="flex items-center justify-between cursor-pointer text-xs"
                      >
                        <span>Original ({languageNative(sourceLang)})</span>
                        {audioTrack === "original" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Closed Captions CC Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-lg ${
                          captionMode !== "off"
                            ? "bg-primary text-primary-foreground"
                            : "text-white hover:bg-white/20"
                        }`}
                        aria-label="Subtitles"
                      >
                        <Captions className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-zinc-950/95 text-white border-zinc-800">
                      <DropdownMenuLabel className="text-xs text-zinc-400">Subtitles / Captions (CC)</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem
                        onClick={() => setCaptionMode("target")}
                        className="flex items-center justify-between cursor-pointer text-xs"
                      >
                        <span>{languageLabel(targetLang)} ({languageNative(targetLang)})</span>
                        {captionMode === "target" && <Check className="h-3.5 w-3.5 text-amber-400" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setCaptionMode("source")}
                        className="flex items-center justify-between cursor-pointer text-xs"
                      >
                        <span>{languageLabel(sourceLang)} (Original)</span>
                        {captionMode === "source" && <Check className="h-3.5 w-3.5 text-amber-400" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setCaptionMode("off")}
                        className="flex items-center justify-between cursor-pointer text-xs text-zinc-400"
                      >
                        <span>Turn off subtitles</span>
                        {captionMode === "off" && <Check className="h-3.5 w-3.5 text-zinc-400" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Speed Settings */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-white/20 rounded-lg"
                        aria-label="Playback Speed"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-zinc-950/95 text-white border-zinc-800">
                      <DropdownMenuLabel className="text-xs text-zinc-400">Playback Speed</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                        <DropdownMenuItem
                          key={rate}
                          onClick={() => changePlaybackRate(rate)}
                          className="flex items-center justify-between cursor-pointer text-xs"
                        >
                          <span>{rate}x</span>
                          {playbackRate === rate && <Check className="h-3.5 w-3.5 text-primary" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Fullscreen */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    className="h-8 w-8 text-white hover:bg-white/20 rounded-lg"
                    aria-label="Fullscreen"
                  >
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Player Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/60 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audio Mode:</span>
              <div className="flex rounded-lg bg-muted p-0.5 text-xs">
                <button
                  onClick={() => handleAudioTrackChange("dubbed")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                    audioTrack === "dubbed"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  Translated Dub ({languageNative(targetLang)})
                </button>
                <button
                  onClick={() => handleAudioTrackChange("original")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                    audioTrack === "original"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Music className="h-3 w-3" />
                  Original ({languageNative(sourceLang)})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {dubbedVideoUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => downloadFile(dubbedVideoUrl, dubbedVideoName || "dubbed_video.mp4")}
                >
                  <Download className="h-3.5 w-3.5" /> Dubbed MP4
                </Button>
              )}
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 text-xs"
                onClick={handleBurnCaptions}
                disabled={burningCaptions}
              >
                <Film className="h-3.5 w-3.5" />
                {burningCaptions ? "Burning Subtitles…" : "Burn Hardcoded Captions"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Interactive Transcript & Outputs Panel (4 cols) */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="h-full flex flex-col overflow-hidden border-border/80 shadow-md">
            <CardContent className="p-0 flex flex-col h-full">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
                <div className="border-b p-3 bg-muted/40">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="transcript" className="gap-1.5 text-xs">
                      <ListTree className="h-3.5 w-3.5" /> Timed Cues
                    </TabsTrigger>
                    <TabsTrigger value="downloads" className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" /> Exports
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Timed Interactive Transcript */}
                <TabsContent value="transcript" className="flex-1 p-0 m-0 overflow-hidden">
                  <div className="p-3 border-b bg-muted/10 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">Click any cue to seek video</p>
                    <Badge variant="outline" className="text-[10px]">
                      {translatedSegments.length} cues
                    </Badge>
                  </div>
                  <ScrollArea className="h-[380px] p-3">
                    <div className="space-y-2">
                      {translatedSegments.map((seg, idx) => {
                        const isActive = currentTime >= seg.start && currentTime <= seg.end;
                        const sourceSeg = sourceSegments[idx];

                        return (
                          <div
                            key={idx}
                            onClick={() => seekToSegment(seg.start)}
                            className={`group cursor-pointer rounded-xl p-3 transition-all border ${
                              isActive
                                ? "bg-primary/10 border-primary/40 shadow-sm ring-1 ring-primary/20"
                                : "bg-card hover:bg-muted/50 border-border/60"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <Badge
                                variant={isActive ? "default" : "secondary"}
                                className="font-mono text-[10px] px-1.5 py-0.5"
                              >
                                {formatTime(seg.start)} → {formatTime(seg.end)}
                              </Badge>
                              {isActive && (
                                <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                                  <Radio className="h-2.5 w-2.5 animate-pulse" /> Active
                                </span>
                              )}
                            </div>

                            <p className="text-sm font-medium leading-relaxed text-foreground" lang={targetLang}>
                              {seg.text}
                            </p>

                            {sourceSeg?.text && (
                              <p className="mt-1 text-xs text-muted-foreground leading-normal line-clamp-2 italic" lang={sourceLang}>
                                {sourceSeg.text}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Downloads & Exports Tab */}
                <TabsContent value="downloads" className="flex-1 p-4 m-0 space-y-4">
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Video & Audio</p>

                    {dubbedVideoUrl && (
                      <Button
                        variant="outline"
                        className="w-full justify-between text-xs h-10"
                        onClick={() => downloadFile(dubbedVideoUrl, dubbedVideoName || "dubbed.mp4")}
                      >
                        <span className="flex items-center gap-2">
                          <Film className="h-4 w-4 text-emerald-500" /> Dubbed Video ({languageLabel(targetLang)})
                        </span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}

                    {separateAudioUrl && (
                      <Button
                        variant="outline"
                        className="w-full justify-between text-xs h-10"
                        onClick={() => downloadFile(separateAudioUrl, audioName || "speech.mp3")}
                      >
                        <span className="flex items-center gap-2">
                          <Music className="h-4 w-4 text-purple-500" /> Spoken Voice Track (MP3)
                        </span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subtitles (Captions)</p>

                    {outputSrt && (
                      <Button
                        variant="outline"
                        className="w-full justify-between text-xs h-10"
                        onClick={() => {
                          const blob = new Blob([outputSrt], { type: "application/x-subrip" });
                          const url = URL.createObjectURL(blob);
                          downloadFile(url, `${jobId}.${targetLang}.srt`);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <Captions className="h-4 w-4 text-amber-500" /> Subtitles (SRT)
                        </span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}

                    {outputVtt && (
                      <Button
                        variant="outline"
                        className="w-full justify-between text-xs h-10"
                        onClick={() => {
                          const blob = new Blob([outputVtt], { type: "text/vtt" });
                          const url = URL.createObjectURL(blob);
                          downloadFile(url, `${jobId}.${targetLang}.vtt`);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" /> WebVTT Captions (VTT)
                        </span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
