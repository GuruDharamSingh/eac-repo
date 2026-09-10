import type { DeckCard, DeckStack } from "@elkdonis/nextcloud";

/**
 * Presentation rules borrowed from Nextcloud Deck itself, so a card means the
 * same thing here as it does in the org's Nextcloud: same label chips, same
 * due-date urgency colours, same ordering.
 */

export interface StackState extends DeckStack {
  cards: DeckCard[];
}

/** Deck orders stacks and cards by `order`; the API returns them unsorted. */
export function toStackState(stacks: DeckStack[]): StackState[] {
  return [...stacks]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      ...s,
      cards: [...(s.cards ?? [])]
        .filter((c) => !c.archived)
        .sort((a, b) => a.order - b.order),
    }));
}

export function findStackOf(stacks: StackState[], cardId: number): StackState | undefined {
  return stacks.find((s) => s.cards.some((c) => c.id === cardId));
}

export type DueState = "overdue" | "today" | "soon" | "later";

/**
 * Deck's own thresholds: past due is an error, due within the day is a
 * warning, due within the week is a soft nudge, anything further is plain.
 */
export function dueState(due: Date, now = new Date()): DueState {
  const ms = due.getTime() - now.getTime();
  if (ms < 0) return "overdue";
  if (ms < 24 * 60 * 60 * 1000) return "today";
  if (ms < 7 * 24 * 60 * 60 * 1000) return "soon";
  return "later";
}

export const DUE_CLASSES: Record<DueState, string> = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  soon: "bg-muted text-foreground/80",
  later: "bg-muted text-muted-foreground",
};

export function formatDue(due: Date): string {
  return due.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

/**
 * Deck stores label colours as bare hex with no contrast guarantee (its own
 * palette runs from #F1DB50 to #317CCC), so the text colour is derived per
 * label rather than fixed. Relative luminance, sRGB coefficients.
 */
export function labelTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#000000";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

/** `2026-09-30T00:00:00+00:00` → `2026-09-30`, for a date input's value. */
export function toDateInputValue(duedate: string | null): string {
  if (!duedate) return "";
  const d = new Date(duedate);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** A date input's `2026-09-30` → the ISO instant Deck stores. */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
