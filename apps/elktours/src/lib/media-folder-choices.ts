// Pure helpers for the Stops/ move choices (2026-11-20), safe in client components. Server code: lib/media-folders.ts.

/**
 * place: the place's folder, a place row and a stop row (needs a stop with a place).
 * stop: the tour's folder and a stop row (needs a stop). overview: the tour's folder and a gallery row (the tour's
 * overview pictures). leave: stays in Stops/, where the tour page keeps reading it.
 */
export type MoveChoice = "place" | "stop" | "overview" | "leave";

export const moveItemKey = (it: { folder: string; file: string }) => `${it.folder}/${it.file}`;

export function allowedChoices(it: { stopId: string | null; placeId: string | null }): MoveChoice[] {
  return [...(it.placeId && it.stopId ? (["place"] as const) : []), ...(it.stopId ? (["stop"] as const) : []), "overview", "leave"];
}
