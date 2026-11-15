"use server";

// ============================================================================
// Studio · Create's loader (canvas A, 2026-11-14;
// docs/sessions/2026-11-14_studio-create-summary.md). One call per acting org
// (`oad` is "Just me"), for the signed-in person only; the org id is a hint
// and every part applies its own read rules:
//   library   @elkdonis/content listContent (org managers see drafts; others listed work)
//   next      Channel's next moves (channelNextSource: the list the dock and
//             `channel-next` read; loadChannelModel scopes to orgs the person
//             owns or guides, else their own channel)
//   material  the person's own recordings and files (studio_items, stage "in")
//             that no studio_item_links row uses as a source yet
//   kit       the org's site_themes colours and fonts (the person's own theme
//             for "Just me"), read-only
// Each part fails alone and comes back empty; the screen still opens.
// ============================================================================

import { db } from "@elkdonis/db";
import { getThemeOverrides } from "@elkdonis/services";
import { listStudioItems } from "@elkdonis/services/studio-items";
import { listContent } from "@elkdonis/content/server";
import { typeLabel } from "@elkdonis/content/registry";
import type { ChannelNextMove } from "@elkdonis/actions";
import type { CreateKit, CreateLibraryItem, CreateMaterial, StudioCreateData } from "@elkdonis/studio/create";
import { getCurrentUser } from "@/lib/session";
import { channelNextSource } from "@/lib/channel/next-source";

const PERSONAL_ORG_ID = "oad";
const ORG_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Moves that are the person's own work for now, preferred for the column's card. */
const OWN_WORK = new Set(["live", "slot", "step", "todo", "draft"]);
const MATERIAL_SHOWN = 5;

async function part<T>(what: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[studio-create] ${what}:`, (err as Error).message);
    return fallback;
  }
}

export async function loadStudioCreateAction(orgId: string): Promise<StudioCreateData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const org = typeof orgId === "string" && ORG_ID.test(orgId) ? orgId : PERSONAL_ORG_ID;
  const personal = org === PERSONAL_ORG_ID;

  const [library, moves, material, kit] = await Promise.all([
    part("library", [] as CreateLibraryItem[], async () => {
      const res = await listContent({ userId: user.id }, personal ? { ownerUserId: user.id, limit: 200 } : { orgId: org, limit: 200 });
      return res.items.map<CreateLibraryItem>((i) => ({
        key: i.key,
        type: i.type,
        typeLabel: typeLabel(i.type),
        title: i.title,
        meta: i.meta,
        cover: i.cover,
        status: i.status,
        date: i.date,
      }));
    }),
    part("next", [] as ChannelNextMove[], () => channelNextSource({ userId: user.id, orgId: personal ? null : org, limit: 6 })),
    part("material", { items: [] as CreateMaterial[], more: 0 }, () => unusedMaterial(user.id)),
    part("kit", { colors: [], fonts: [], editHref: null } as CreateKit, () => kitOf(user.id, personal ? null : org)),
  ]);

  const pick = moves.find((m) => OWN_WORK.has(m.kind)) ?? moves[0] ?? null;
  return {
    library,
    next: pick
      ? { kicker: pick.kicker, title: pick.title, reason: pick.reason, href: pick.href, label: pick.open?.label ?? "Open" }
      : null,
    nextMore: Math.max(0, moves.length - (pick ? 1 : 0)),
    material: material.items,
    materialMore: material.more,
    kit,
  };
}

/** The person's recordings and files that nothing has been made from yet, newest first. */
async function unusedMaterial(userId: string): Promise<{ items: CreateMaterial[]; more: number }> {
  const all = (await listStudioItems(userId, { stage: "in", limit: 80 })).filter((i) => i.kind === "recording" || i.kind === "file");
  if (!all.length) return { items: [], more: 0 };
  const used = await db<Array<{ source_id: string }>>`
    SELECT DISTINCT source_id FROM studio_item_links WHERE source_id = ANY(${all.map((i) => i.id)})
  `;
  const usedIds = new Set(used.map((r) => r.source_id));
  const unused = all.filter((i) => !usedIds.has(i.id));
  return {
    items: unused.slice(0, MATERIAL_SHOWN).map((i) => ({
      id: i.id,
      kind: i.kind === "recording" ? "recording" : "file",
      title: i.title || "Untitled",
      updatedAt: i.updatedAt,
    })),
    more: Math.max(0, unused.length - MATERIAL_SHOWN),
  };
}

/** A stored theme value as a CSS colour: hex, a colour function, or a bare HSL triplet ("18 54% 38%"). */
function colourOf(raw: string): string | null {
  const v = raw.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([^()]*\)$/i.test(v)) return v;
  if (/^\d{1,3}(?:\.\d+)?\s+\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%$/.test(v)) return `hsl(${v})`;
  return null;
}

const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "system-ui", "cursive", "fantasy", "ui-serif", "ui-sans-serif"]);

/** The first family of a stored font stack, unquoted. */
function fontOf(raw: string): string | null {
  const first = raw.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
  return first && !GENERIC_FONTS.has(first.toLowerCase()) ? first : null;
}

/** The kit as the site's saved theme states it: colours in stored order, then up to two font families. */
async function kitOf(userId: string, orgId: string | null): Promise<CreateKit> {
  const vars = orgId ? await getThemeOverrides({ orgId }) : await getThemeOverrides({ userId });
  const colors: string[] = [];
  const fonts: string[] = [];
  for (const [name, value] of Object.entries(vars)) {
    if (typeof value !== "string") continue;
    if (/font/i.test(name)) {
      const f = fontOf(value);
      if (f && !fonts.includes(f)) fonts.push(f);
      continue;
    }
    const c = colourOf(value);
    if (c && !colors.includes(c)) colors.push(c);
  }
  return {
    colors: colors.slice(0, 6),
    fonts: fonts.slice(0, 2),
    // The hub's organization page holds the site theme editor (owners and guides; theme-actions.ts).
    editHref: orgId ? `/hub/organization?org=${encodeURIComponent(orgId)}` : null,
  };
}
