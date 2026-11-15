"use server";

import { listPersonChoices, listPersonSources } from "@elkdonis/services/featured-people";
import type { RecordChoice, RecordSourceItem } from "@elkdonis/direct-edit/puck";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { loadProfileFor, siteGuide } from "./data-profile";

// ============================================================================
// "From what?" for "Profile card" (2026-11-14): the chooser for `binds: "guide"` (pt-profile), in Puck Studio, the
// canvas editor and its popup. The same people and following choices as Featured person (this site's public
// profiles; a gathering's or series' author, host or guide), so the stored reference is the same grammar. What a
// value draws is the card's own `guide` and `links`. Owners and guides only, as featured-person-actions.ts.
// ============================================================================

export async function guideSourcesAction(): Promise<RecordSourceItem[]> {
  if (!(await getApiEditor())) return [];
  const site = await siteGuide().catch(() => null);
  const people = await listPersonSources(siteConfig.orgId).catch(() => []);
  return [
    { ref: "site", label: "The site's guide", hint: site ? `Now: ${site.displayName}` : "No public profile yet" },
    ...people.map((s) => ({ ref: s.ref, label: s.label, hint: s.hint })),
  ];
}

export async function guideChoicesAction(source: string): Promise<RecordChoice[]> {
  if (!(await getApiEditor())) return [];
  if (source === "site") {
    const site = await siteGuide().catch(() => null);
    // "" is the stored value for the site's guide: the chooser stores it as it stores a cleared choice.
    return [{ value: "", label: "The site's guide", follows: true, hint: site ? `Now: ${site.displayName}, an owner of this organisation` : "No public profile yet" }];
  }
  const rows = await listPersonChoices(siteConfig.orgId, source).catch(() => []);
  return rows.map((c) => ({ value: c.value, label: c.label, hint: c.hint, follows: c.follows, disabled: c.disabled }));
}

/** What a value draws, keyed as pt-profile's resolver keys it (`guide`, `links`). Plain JSON. */
export async function guideDrawAction(value: string): Promise<Record<string, unknown> | null> {
  if (!(await getApiEditor())) return null;
  return JSON.parse(JSON.stringify(await loadProfileFor(value))) as Record<string, unknown>;
}
