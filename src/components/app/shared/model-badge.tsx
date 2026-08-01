"use client";

import { Badge } from "@/components/ui/badge";
import { Cpu } from "lucide-react";
import { getModel } from "@/lib/domain/models";
import { cn } from "@/lib/utils";

interface ModelBadgeProps {
  modelId: string;
  className?: string;
  /** Show the model name; else show the raw id. */
  label?: string;
}

export function ModelBadge({ modelId, className, label }: ModelBadgeProps) {
  const model = getModel(modelId);
  const name = label ?? model?.name ?? modelId;
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1 font-mono text-[11px]", className)}
      title={model ? `${model.name} · ${model.provider} · ${model.license}` : modelId}
    >
      <Cpu className="h-3 w-3" />
      {name}
    </Badge>
  );
}
