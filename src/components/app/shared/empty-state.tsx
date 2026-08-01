"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center",
      "bg-gradient-to-br from-muted/30 via-transparent to-muted/20",
      className,
    )}>
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" style={{ animationDuration: "3s" }} />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/5">
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>}
      </div>
      {action}
    </div>
  );
}
