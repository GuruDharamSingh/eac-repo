"use server";

import { getApiEditor } from "@/lib/auth";
import type { RecordChoice, RecordSourceItem } from "@elkdonis/direct-edit/puck";
import type { MobileExperience, MobileGuide, MobilePlace } from "@/blocks/mobile/types";
import { experiencesFor, guidesFor, pickChoices, pickDraw, pickSources, shelfFor, tourCardsFor } from "./mobile-pick";
import { shownMenu } from "./mobile-menu";

// The editor's copies of the new phone resolvers and the "From what?" lists for place, cover, guide, experience and tour
// (2026-11-21). Draws are public data, as the existing mobile*Action functions are; the lists are gated to owners and
// guides like the other pickers (a client component is not a boundary).

export async function mobileShelfAction(props: Record<string, unknown>): Promise<{ places: MobilePlace[]; placesCount: number }> {
  return shelfFor(props, undefined);
}
export async function mobileGuidesPickAction(props: Record<string, unknown>): Promise<MobileGuide[]> {
  return guidesFor(props, undefined);
}
export async function mobileExperiencesPickAction(props: Record<string, unknown>): Promise<MobileExperience[]> {
  return experiencesFor(props, undefined);
}
export async function tourCardsAction(props: Record<string, unknown>): Promise<{ tour: unknown; next: unknown }[]> {
  return tourCardsFor(props);
}
export async function mobileMenuAction(items: unknown) {
  return shownMenu(items);
}

export async function pickSourcesAction(binds: string): Promise<RecordSourceItem[]> {
  if (!(await getApiEditor())) return [];
  return pickSources(binds);
}
export async function pickChoicesAction(binds: string, source: string): Promise<RecordChoice[]> {
  if (!(await getApiEditor())) return [];
  return pickChoices(binds, source);
}
export async function pickDrawAction(binds: string, value: string): Promise<{ label: string } | null> {
  if (!(await getApiEditor())) return null;
  return pickDraw(binds, value);
}
