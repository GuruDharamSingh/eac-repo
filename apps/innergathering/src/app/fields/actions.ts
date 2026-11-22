"use server";

// The Fields lens's two doors on this site: load a block's stored words (or a card's record), save some. Everything is
// in lib/fields-site.ts; this file only exports it as server actions. Gated there, on every call.

import { siteFields } from "@/lib/fields-site";

export async function loadFieldsAction(args: { kind: string; id: string }) {
  return siteFields.load(args);
}

export async function saveFieldsAction(input: { kind: string; id: string; values: Record<string, string>; version?: string }) {
  return siteFields.save(input);
}
