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

  // Clear and re-measure rect whenever step or selector changes
  useEffect(() => {
    setRect(null);
    if (!selector) return;

    const measure = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          return;
        }
      }
      setRect(null);
    };

    // Scroll into view if needed
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      } catch {
        // fallback
      }
    }

    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [selector, index]);

  // Re-measure on resize or scroll
  useEffect(() => {
    if (!selector) return;
    const onReposition = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          return;
        }
      }
      setRect(null);
    };

    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [selector]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (isLast) onClose();
        else setIndex((i) => Math.min(i + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLast, onClose, steps.length]);

  const effectiveRect = hasSelector ? rect : null;

  // Compute position for tooltip
  let tooltipStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(420px, calc(100vw - 32px))",
  };

  if (effectiveRect) {
    let top = effectiveRect.top + effectiveRect.height + PADDING + 12;
    if (top + 220 > window.innerHeight) {
      top = Math.max(16, effectiveRect.top - 230);
    }
    const left = Math.max(16, Math.min(effectiveRect.left, window.innerWidth - 360));
    tooltipStyle = {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: "min(340px, calc(100vw - 32px))",
    };
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding tour"
    >
      {/* Dark overlay backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Highlighting Spotlight Cutout */}
      {effectiveRect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300 ease-out"
          style={{
            top: effectiveRect.top - PADDING,
            left: effectiveRect.left - PADDING,
            width: effectiveRect.width + PADDING * 2,
            height: effectiveRect.height + PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
          }}
        />
      )}

      {/* Tooltip Dialog Card */}
      <div
        style={tooltipStyle}
        className={cn(
          "pointer-events-auto z-10 rounded-xl border bg-popover p-5 text-popover-foreground shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tour · {index + 1} of {steps.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Skip tour"
          >
            Skip tour <X className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>

        <h3 className="text-base font-semibold leading-tight">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        {/* Progress dots & Actions */}
        <div className="mt-5 flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setIndex((i) => i - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" className="gap-1.5 text-xs font-medium" onClick={onClose}>
                Get started <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5 text-xs font-medium" onClick={() => setIndex((i) => i + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
