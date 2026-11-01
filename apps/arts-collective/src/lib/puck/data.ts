import { loadThreadFeed } from "@elkdonis/blocks/server";
import { listOrgPeople } from "@elkdonis/services";
import { getOfferingThread } from "@/lib/org";
import type { OfferingRecord } from "@/blocks/ac-offering";
import type { PersonChip } from "@/blocks/ac-people";

// ============================================================================
// Rows for the data blocks, by org.
//
// One loader serves both the published page (through config.server's
// resolvers) and the editor (through /api/org/<slug>/blocks/<id>). Everything
// here is already public on the org's own site: `loadThreadFeed` writes its
// published/PUBLIC clauses itself, the offering is what `/offering` shows,
// and the people are the chips on `/profile`. Output is plain JSON: Puck
// deep-copies a Date into `{}`.
// ============================================================================

import { BLOCK_DATA_IDS, isBlockDataId, type BlockDataId } from "./block-ids";

export { BLOCK_DATA_IDS, isBlockDataId, type BlockDataId };

const iso = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export async function loadBlockData(
  id: BlockDataId,
  orgId: string,
  props: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (id) {
    case "thread-feed": {
      const raw = typeof props.limit === "number" ? props.limit : Number(props.limit);
      const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 50) : 10;
      const items = await loadThreadFeed(orgId, {
        limit,
        upcomingOnly: true,
        // Threads on an org subdomain answer at /<slug>, not under a feed.
        href: (r) => `/${r.slug}`,
      });
      return { items: items.map((i) => ({ ...i, scheduledAt: iso(i.scheduledAt) })) };
    }
    case "ac-offering": {
      const t = await getOfferingThread(orgId);
      const offering: OfferingRecord | null = t
        ? {
            id: t.id,
            title: t.title,
            kind: t.kind,
            href: t.slug ? `/${t.slug}` : "/offering",
            excerpt: t.excerpt,
            scheduledAt: iso(t.scheduled_at),
            location: t.location,
            price: t.price != null ? String(t.price) : null,
            currency: t.currency,
            coverImageUrl: null,
            pinned: Boolean(t.pinned),
          }
        : null;
      return { offering };
    }
    case "ac-people": {
      const rows = await listOrgPeople(orgId).catch(() => []);
      const people: PersonChip[] = rows
        .filter((p) => p.role !== "viewer")
        .map((p) => ({
          id: p.userId,
          name: p.displayName ?? "A member",
          avatarUrl: p.avatarUrl,
          role: p.role,
          href: null,
        }));
      return { people };
    }
  }
}
