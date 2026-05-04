"use client";

import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
};

export function KeywordInput({
  value,
  onChange,
  placeholder = "Type a keyword and press Enter",
  max = 12,
}: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    const pieces = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [...value];
    for (const p of pieces) {
      if (merged.length >= max) break;
      if (!merged.includes(p) && p.length <= 50) merged.push(p);
    }
    onChange(merged);
    setDraft("");
  };

  const remove = (k: string) => onChange(value.filter((x) => x !== k));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-2 focus-within:border-primary/60",
          value.length === 0 && "py-1.5"
        )}
      >
        {value.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground"
          >
            {k}
            <button
              type="button"
              onClick={() => remove(k)}
              className="rounded-full text-accent-foreground/70 transition hover:text-accent-foreground"
              aria-label={`Remove ${k}`}
            >
              ×
            </button>
          </span>
        ))}
        <Input
          className="h-8 min-w-[120px] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          placeholder={value.length >= max ? "Max reached" : placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={add}
          disabled={value.length >= max}
        />
      </div>
      {value.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {value.length}/{max} keywords
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            className="h-auto px-2 py-1 text-xs"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
