// Types for the artist and place leads in the suggestions queue (kinds 'artist' and 'place_lead',
// migrations-draft/visitor_suggestions_artist_place_kinds.sql). Spots and routes keep VisitorSuggestion.
import type { SuggestionStatus } from "@/lib/catalogue-types";

export type LeadKind = "artist" | "place_lead";

export interface LeadSuggestion {
  id: string;
  kind: LeadKind;
  status: SuggestionStatus;
  /** The name given. */
  name: string;
  why: string | null;
  url: string | null;
  /** Optional contact the person left. Editors only. */
  email: string | null;
  suggester: { userId: string; name: string | null; slug: string | null };
  rejectReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
