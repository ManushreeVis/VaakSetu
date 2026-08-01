"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "primary" | "accent" | "muted";
  className?: string;
}

const accentMap = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent text-accent-foreground",
  muted: "bg-muted text-muted-foreground",
} as const;

export function StatCard({ icon: Icon, label, value, hint, accent = "primary", className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", accentMap[accent])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
