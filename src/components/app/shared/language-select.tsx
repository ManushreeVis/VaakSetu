"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from "@/lib/domain/languages";

interface LanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** "source" includes auto-detect; "target" is mr/hi/en only. */
  variant: "source" | "target";
  className?: string;
  id?: string;
}

export function LanguageSelect({ value, onChange, variant, className, id }: LanguageSelectProps) {
  const options = variant === "source" ? SOURCE_LANGUAGES : TARGET_LANGUAGES;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={className} aria-label={`${variant} language`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.code} value={opt.code}>
            <span className="flex items-center gap-2">
              <span className="font-medium">{opt.label}</span>
              <span className="text-muted-foreground text-xs devanagari">{opt.native}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
