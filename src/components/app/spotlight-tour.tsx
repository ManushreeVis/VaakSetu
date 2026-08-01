"use client";

import { useEffect, useState } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TourStep {
  title: string;
  body: string;
  selector: string | null;
}

interface SpotlightTourProps {
  steps: TourStep[];
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

export function SpotlightTour({ steps, onClose }: SpotlightTourProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const selector = step?.selector ?? null;
  const hasSelector = Boolean(selector);

  // Measure on step change (after scroll settles via rAF). Only runs when a selector exists.
  useEffect(() => {
    if (!selector) return;
    let raf = 0;
    let cleanup = 0;
    const trigger = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          const el = document.querySelector(selector) as HTMLElement | null;
          if (!el) return;
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        });
      });
    };
    cleanup = window.setTimeout(trigger, 350);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cleanup);
    };
  }, [selector]);

  // Re-measure on resize/scroll.
  useEffect(() => {
    if (!selector) return;
    const onResize = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [selector]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (isLast) onClose();
        else setIndex((i) => Math.min(i + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLast, onClose, steps.length]);

  // When there's no selector for this step, ignore any stale rect.
  const effectiveRect = hasSelector ? rect : null;

  // Tooltip position: prefer right of the target, fall back to centered.
  const tooltipStyle: React.CSSProperties = effectiveRect
    ? {
        position: "fixed",
        top: Math.max(16, Math.min(effectiveRect.top + effectiveRect.height + PADDING + 8, window.innerHeight - 220)),
        left: Math.max(16, Math.min(effectiveRect.left, window.innerWidth - 360)),
        width: "min(340px, calc(100vw - 32px))",
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(420px, calc(100vw - 32px))",
      };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Onboarding tour">
      {/* Dark overlay with cutout */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      {effectiveRect && (
        <div
          className="absolute rounded-lg ring-2 ring-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
          style={{
            top: effectiveRect.top - PADDING,
            left: effectiveRect.left - PADDING,
            width: effectiveRect.width + PADDING * 2,
            height: effectiveRect.height + PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        style={tooltipStyle}
        className={cn(
          "z-10 rounded-xl border bg-popover p-5 text-popover-foreground shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tour · {index + 1} / {steps.length}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close tour">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h3 className="text-base font-semibold leading-tight">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setIndex((i) => i - 1)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" className="gap-1.5" onClick={onClose}>
                Get started <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={() => setIndex((i) => i + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
