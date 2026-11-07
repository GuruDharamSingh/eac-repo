"use server";

import type { FeaturedWho } from "@elkdonis/blocks";
import { listPersonChoices, listPersonSources, type PersonChoice, type PersonSource } from "@elkdonis/services/featured-people";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { featuredWho } from "./featured-person";
import type { RecordChoice, RecordSourceItem } from "@elkdonis/direct-edit/puck";
import { cardRecord, opensChoices, opensSources, resolveOpens } from "./opens-server";

// The editor's "From what?" lists for a Featured person (2026-11-07, as on elktours). Owners and guides only: the lists name
// people and records the page does not show yet. Checked here because a client component is not a boundary.

export async function personSourcesAction(): Promise<PersonSource[]> {
  if (!(await getApiEditor())) return [];
  return listPersonSources(siteConfig.orgId);
}

export async function personChoicesAction(source: string): Promise<PersonChoice[]> {
  if (!(await getApiEditor())) return [];
  return listPersonChoices(siteConfig.orgId, source);
}

/** What a value draws, the same answer a visitor's page gets. */
export async function personWhoAction(ref: string): Promise<FeaturedWho | null> {
  if (!(await getApiEditor())) return null;
  return featuredWho(ref);
}

// "Opens" and a Card's "Filled from" (2026-11-07, as on elktours): the same gate. Lists only what a visitor could see.

export async function opensSourcesAction(binds: string): Promise<RecordSourceItem[]> {
  if (!(await getApiEditor())) return [];
  return opensSources(binds === "record" ? "record" : "opens");
}

export async function opensChoicesAction(binds: string, source: string): Promise<RecordChoice[]> {
  if (!(await getApiEditor())) return [];
  return opensChoices(binds === "record" ? "record" : "opens", source);
}

/** What a value draws, keyed as the block's resolver keys it: `opened` for Opens, `bound` for a Card's record. */
export async function opensDrawAction(binds: string, value: string): Promise<Record<string, unknown> | null> {
  if (!(await getApiEditor())) return null;
  if (binds === "record") { const bound = await cardRecord(value); return bound ? { bound } : null; }
  const opened = await resolveOpens(value);
  return opened ? { opened } : null;
}
