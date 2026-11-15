"use server";

import { getServiceOffering, listServiceOfferings, servicePriceLabel } from "@elkdonis/services";
import type { RecordChoice, RecordSourceItem } from "@elkdonis/direct-edit/puck";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { loadBooking, toWireService } from "./data-service";

// ============================================================================
// "From what?" for a service (2026-11-14, editing landscape round 1): the
// canvas editor's chooser for `binds: "service"` (pt-service, pt-booking).
// Puck Studio keeps its own ServicePickerField for the same prop; both store
// the service's slug, and "" (the cleared choice) still means the visitor's
// `?service=…`, else the newest (data-service.ts `pick`).
//
// Owners and guides only, as featured-person-actions.ts: a client component is
// not a boundary. Lists what this site's services page lists.
// ============================================================================

const SOURCE = "services";

const STATUS: Record<string, string> = { waitlist: "waitlist", full: "full", closed: "closed" };

export async function serviceSourcesAction(): Promise<RecordSourceItem[]> {
  if (!(await getApiEditor())) return [];
  const all = await listServiceOfferings(siteConfig.orgId).catch(() => []);
  return [{ ref: SOURCE, label: "This site's services", hint: all.length === 1 ? "1 offered" : `${all.length} offered` }];
}

export async function serviceChoicesAction(source: string): Promise<RecordChoice[]> {
  if (source !== SOURCE || !(await getApiEditor())) return [];
  const all = await listServiceOfferings(siteConfig.orgId).catch(() => []);
  return all.map((o) => ({
    value: o.slug,
    label: o.title,
    hint: [servicePriceLabel(o), STATUS[o.registrationStatus ?? ""]].filter(Boolean).join(" · ") || undefined,
  }));
}

/**
 * What a chosen slug draws, keyed as each block's resolver keys it: `chosen` for pt-service, `booking` for
 * pt-booking. One answer for both: the chooser is asked by kind, not by block, and the canvas only draws with it
 * (never stores it). Null when the slug is not one of this site's services; the page then draws the newest.
 */
export async function serviceDrawAction(slug: string): Promise<Record<string, unknown> | null> {
  if (!(await getApiEditor())) return null;
  const hit = slug ? await getServiceOffering(siteConfig.orgId, slug).catch(() => null) : null;
  if (!hit) return null;
  const { booking } = await loadBooking({ service: slug }, {});
  return { chosen: toWireService(hit), booking };
}
