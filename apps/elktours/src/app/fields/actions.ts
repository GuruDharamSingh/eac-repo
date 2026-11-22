"use server";

// The Fields lens's two doors on this site: load a block's stored words (or a card's record), save some. Everything is
// in lib/fields-site.ts; this file only exports it as server actions. Gated there, on every call.

import { siteFields } from "@/lib/fields-site";
import { TOUR_KINDS, tourFields } from "@/lib/fields-tour";

// A tour's own words (`record:tour:…`, `record:tourstop:…`) go to lib/fields-tour.ts, which checks the person against that
// tour on every call; everything else is the shared site door.
export async function loadFieldsAction(args: { kind: string; id: string }) {
  return TOUR_KINDS.has(args.kind) ? tourFields.load(args) : siteFields.load(args);
}

export async function saveFieldsAction(input: { kind: string; id: string; values: Record<string, string>; version?: string }) {
  return TOUR_KINDS.has(input.kind) ? tourFields.save(input) : siteFields.save(input);
}

/** "Put back the previous version" of one field of a tour or a stop. */
export async function restoreFieldsAction(input: { kind: string; id: string; field: string }) {
  if (!TOUR_KINDS.has(input.kind)) return { ok: false as const, error: "This record keeps no earlier version." };
  return tourFields.restore(input);
}
