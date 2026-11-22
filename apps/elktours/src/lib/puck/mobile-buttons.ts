import { getProfile } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { listPlacesPublic } from "@/lib/places-public";
import { buttonsFor, type ShownButton } from "@/blocks/mobile/page-buttons-logic";
import type { ViewerLike } from "./viewer-rank";

// The server side of m-page-buttons (2026-11-21): who is looking, and which buttons they may see. Server only.
// The visitor's answer is decided here from the session; nothing a visitor may not see is returned to the block.

const soft = <T,>(p: Promise<T>, empty: T): Promise<T> => p.catch(() => empty);

/** The person looking, as the rank table wants them: null when signed out. `name` is their first name, if on file. */
export async function viewerLike(): Promise<ViewerLike | null> {
  const v = await soft(getViewer(), null);
  if (!v) return null;
  const prof = await soft(getProfile(v.userId), null);
  const first = (prof?.displayName ?? "").trim().split(/\s+/)[0] || null;
  return { role: v.role, name: first };
}

/** `all`: an editor (owner or guide, checked by the caller) gets every button with a note of who it is for. */
export async function shownButtons(rows: unknown, accountLabel: unknown, metadata?: Record<string, unknown>, all = false): Promise<ShownButton[]> {
  const given = (metadata?.mobileDiscover as { placesCount?: number } | undefined)?.placesCount;
  const count = typeof given === "number" ? given : (await soft(listPlacesPublic(), { places: [], tagOrder: [], favouriteCount: 0 })).places.length;
  return buttonsFor(rows, { viewer: await viewerLike(), count, accountLabel: typeof accountLabel === "string" && accountLabel ? accountLabel : "Account", all });
}
