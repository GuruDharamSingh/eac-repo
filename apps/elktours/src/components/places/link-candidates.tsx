"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlaceLinkCandidate } from "@/lib/catalogue-types";
import { approvePlaceLinkAction, listLowConfidenceLinksAction, removePlaceLinkAction } from "@/lib/place-actions";

const KIND: Record<string, string> = {
  wikipedia_en: "Wikipedia",
  wikipedia_fr: "Wikipédia (fr)",
  website: "Official site",
  wikidata: "Wikidata",
  osm: "OpenStreetMap",
};

/** The match evidence the enrichment script kept, as a short line. */
function evidence(e: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof e.label === "string") parts.push(`matched “${e.label}”`);
  if (typeof e.sim === "number") parts.push(`name ${Math.round(e.sim * 100)}% alike`);
  if (typeof e.distM === "number") parts.push(`${Math.round(e.distM)} m away`);
  if (typeof e.via === "string") parts.push(`via ${e.via}`);
  if (e.conflict) parts.push(typeof e.conflict === "string" ? `conflict: ${e.conflict}` : "conflicts with another link");
  return parts.join(" · ");
}

/**
 * Links the enrichment script stored but was not sure of (hidden from the
 * public until approved). Editors open each one, then Approve or Remove.
 * With `placeId`, only that place's; without, every place's (grouped).
 */
export function LinkCandidates({ placeId, title = "Links to check" }: { placeId?: string; title?: string }) {
  const router = useRouter();
  const [list, setList] = React.useState<PlaceLinkCandidate[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setList(await listLowConfidenceLinksAction(placeId).catch(() => []));
  }, [placeId]);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function act(c: PlaceLinkCandidate, approve: boolean) {
    setBusy(c.id);
    const r = await (approve ? approvePlaceLinkAction(c.id) : removePlaceLinkAction(c.id)).catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed",
    }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success(approve ? "Link approved: shown publicly" : "Link removed");
    setList((l) => (l ?? []).filter((x) => x.id !== c.id));
    router.refresh();
  }

  if (!list || list.length === 0) return null;

  const groups = new Map<string, PlaceLinkCandidate[]>();
  for (const c of list) (groups.get(c.placeId) ?? groups.set(c.placeId, []).get(c.placeId)!).push(c);

  return (
    <section className="space-y-3 border border-dashed border-border p-4" aria-label={title}>
      <div>
        <h3 className="font-serif text-lg">
          {title} ({list.length})
        </h3>
        <p className="text-sm text-muted-foreground">
          Matched automatically but not with confidence, so they are hidden from visitors. Open each one; approve it to show it, or remove it.
        </p>
      </div>
      {[...groups.entries()].map(([pid, items]) => (
        <div key={pid}>
          {!placeId && (
            <p className="text-sm font-medium">
              <a href={`/manage/places/${pid}`} className="underline underline-offset-4">
                {items[0].placeTitle}
              </a>
            </p>
          )}
          <ul className="mt-1 divide-y divide-border">
            {items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 text-sm">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all underline underline-offset-4">
                  {KIND[c.kind] ?? c.kind} ↗
                </a>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {[`source: ${c.source}`, evidence(c.evidence)].filter(Boolean).join(" · ")}
                </span>
                <span className="flex gap-3">
                  <button type="button" disabled={busy === c.id} onClick={() => act(c, true)} className="font-medium underline underline-offset-4 disabled:opacity-50">
                    Approve
                  </button>
                  <button type="button" disabled={busy === c.id} onClick={() => act(c, false)} className="text-muted-foreground underline underline-offset-4 disabled:opacity-50">
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
