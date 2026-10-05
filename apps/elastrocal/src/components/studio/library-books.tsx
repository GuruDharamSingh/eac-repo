"use client";

import { useState } from "react";
import Link from "next/link";
import type { LibraryBookRef } from "@elkdonis/astro-corpus/server";
import { cn } from "@/lib/utils";

/**
 * The outlined books as cards: title, author, tradition, type, priority, text
 * quality, and tags for the basics each one has. Filters narrow the list;
 * the default order is high priority first. Read-only.
 */

export const BASIC_LABEL: Record<string, string> = {
  glossary: "glossary",
  keyword_lists: "keyword lists",
  fact_sheets: "fact sheets",
  elements: "elements",
  modes: "modes",
  signs: "signs",
  planets: "planets",
  houses: "houses",
  aspects: "aspects",
  planet_in_sign: "planet in sign",
  planet_in_house: "planet in house",
  planet_aspects: "planet aspects",
  ascendant_signs: "ascendant signs",
};
export const words = (v: string | null | undefined) => (v ? v.replace(/_/g, " ") : "not said");
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const QUALITY_TONE: Record<string, string> = { good: "border-primary/50 text-primary", damaged_headings: "border-gold text-foreground", garbled: "border-destructive/60 text-destructive", mostly_tables: "border-border text-muted-foreground" };

export function LibraryBooks({ books }: { books: LibraryBookRef[] }) {
  const [priority, setPriority] = useState("");
  const [tradition, setTradition] = useState("");
  const [type, setType] = useState("");
  const [has, setHas] = useState<string[]>([]);
  const [sort, setSort] = useState<"priority" | "title" | "passages">("priority");
  const values = (f: (b: LibraryBookRef) => string | null | undefined) => [...new Set(books.map(f).filter((x): x is string => Boolean(x)))].sort();
  const shown = books
    .filter((b) => (!priority || b.card?.priority === priority) && (!tradition || b.card?.tradition === tradition) && (!type || b.card?.type === type) && has.every((h) => b.card?.basics[h]?.length))
    .sort((a, b) =>
      sort === "title"
        ? (a.card?.title ?? a.book).localeCompare(b.card?.title ?? b.book)
        : sort === "passages"
          ? b.passages - a.passages
          : (PRIORITY_RANK[a.card?.priority ?? ""] ?? 3) - (PRIORITY_RANK[b.card?.priority ?? ""] ?? 3) || Object.keys(b.card?.basics ?? {}).length - Object.keys(a.card?.basics ?? {}).length || (a.card?.title ?? a.book).localeCompare(b.card?.title ?? b.book),
    );
  const select = (label: string, value: string, set: (v: string) => void, options: string[]) => (
    <label className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1">
        <option value="">any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {words(o)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {select("Priority", priority, setPriority, ["high", "medium", "low"])}
        {select("Tradition", tradition, setTradition, values((b) => b.card?.tradition))}
        {select("Type", type, setType, values((b) => b.card?.type))}
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">Order</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-border bg-background px-2 py-1">
            <option value="priority">high priority first</option>
            <option value="title">by title</option>
            <option value="passages">most passages first</option>
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-sm text-muted-foreground">Has:</span>
        {Object.keys(BASIC_LABEL).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={has.includes(k)}
            onClick={() => setHas((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))}
            className={cn("rounded-full border px-2.5 py-0.5", has.includes(k) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
          >
            {BASIC_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {shown.length} of {books.length} books
      </p>
      <ul className="mt-2 space-y-2">
        {shown.map((b) => (
          <li key={b.slug} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <Link href={`/hub/studio/library/book/${b.slug}`} className="font-semibold hover:text-primary">
                {b.card?.title ?? b.book} →
              </Link>
              {b.card?.priority && (
                <span className={cn("rounded-full border px-2 text-[11px]", b.card.priority === "high" ? "border-primary bg-primary/10 text-primary" : b.card.priority === "medium" ? "border-gold" : "border-border text-muted-foreground")}>
                  {b.card.priority} priority
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {[b.card?.author, b.card ? words(b.card.tradition) : null, b.card ? words(b.card.type) : null, `${b.passages.toLocaleString()} passages`, `${b.sections} sections`].filter(Boolean).join(" · ")}
              {!b.card && " · no card yet"}
              {b.card?.duplicateOf && " · may be a second copy of another book"}
            </p>
            {b.card && (
              <p className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
                {b.card.quality && <span className={cn("rounded-full border px-2 py-px", QUALITY_TONE[b.card.quality])} title={b.card.textQuality ?? undefined}>text: {words(b.card.quality)}</span>}
                {Object.keys(BASIC_LABEL)
                  .filter((k) => b.card!.basics[k]?.length)
                  .map((k) => (
                    <span key={k} className="rounded-full border border-border px-2 py-px">
                      {BASIC_LABEL[k]}
                    </span>
                  ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
