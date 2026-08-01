"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  nativeTitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function ViewHeader({ icon: Icon, title, subtitle, nativeTitle, actions, className }: ViewHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {nativeTitle && (
            <p className="text-sm font-medium text-primary devanagari">{nativeTitle}</p>
          )}
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
