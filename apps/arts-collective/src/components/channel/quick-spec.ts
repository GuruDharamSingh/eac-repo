import { outletLabel } from "./labels";
import type { Outlet, Piece, Suggestion } from "@/lib/channel/model";

// The quick sheet's input, and how a suggestion becomes one. A module of its
// own so chips (bits.tsx) can open the sheet without importing it.

export interface QuickSpec {
  title: string;
  kicker: string;
  pieceKey: string;
  outlet: Outlet;
  identityId: string;
  at: string | null;
  routineId: string | null;
  routineName: string | null;
  deliveryId?: string | null;
  caption?: string;
  quote?: string | null;
}

export function specFromSuggestion(s: Suggestion, piece: Piece | undefined, routineName: string | null): QuickSpec {
  const isQuote = s.chip.includes("Quote");
  return {
    title: piece ? `${isQuote ? "Quote card" : outletLabel(s.outlet)}: ${piece.title}` : s.text,
    kicker: routineName ? `Filling · ${routineName} slot` : s.reason,
    pieceKey: s.pieceKey,
    outlet: s.outlet,
    identityId: s.identityId,
    at: s.at,
    routineId: s.routineId,
    routineName,
    quote: isQuote && piece ? firstSentence(piece.excerpt || piece.title) : null,
  };
}

function firstSentence(text: string): string {
  const s = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return s.slice(0, 180);
}

export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 12).slice(0, 12);
}

