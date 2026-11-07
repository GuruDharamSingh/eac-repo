"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SuggestionStatus, VisitorSuggestion } from "@/lib/catalogue-types";
import { acceptSuggestionAction, rejectSuggestionAction } from "@/lib/suggestion-actions";

const PlacesMap = dynamic(() => import("@/components/places/places-map").then((m) => m.PlacesMap), {
  ssr: false,
  loading: () => <div className="h-56 w-full bg-muted" />,
});

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
}

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  pending: "Waiting",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/**
 * /manage/suggestions: what visitors suggested, spots and walks. Accepting a
 * spot makes a catalogue place credited to them; accepting a walk makes a
 * DRAFT tour from its places (lib/suggestion-actions.ts). Rejecting keeps a
 * reason. Photos are private: shown here to editors only.
 */
export function SuggestionsQueue({ suggestions }: { suggestions: VisitorSuggestion[] }) {
  const router = useRouter();
  const [show, setShow] = React.useState<"pending" | "all">("pending");
  const [busy, setBusy] = React.useState<string | null>(null);
  const list = show === "pending" ? suggestions.filter((s) => s.status === "pending") : suggestions;

  async function accept(s: VisitorSuggestion) {
    const title = window.prompt(s.kind === "spot" ? "Name for the new place:" : "Title for the draft tour:", s.title);
    if (title === null) return;
    setBusy(s.id);
    const r = await acceptSuggestionAction(s.id, { title: title.trim() || s.title }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success(s.kind === "spot" ? "Added to the places catalogue" : "Saved as a draft tour");
    if (r.threadId) router.push(`/manage/tours/${r.threadId}/stops`);
    else if (r.placeId) router.push(`/manage/places/${r.placeId}`);
    else router.refresh();
  }

  async function reject(s: VisitorSuggestion) {
    const reason = window.prompt("Why not? (kept with the suggestion)");
    if (reason === null) return;
    setBusy(s.id);
    const r = await rejectSuggestionAction(s.id, reason.trim() || undefined).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Rejected");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Spots and walks suggested by visitors on the places page. Nothing is published until you accept it.
        </p>
        <div className="flex gap-1 text-sm">
          {(["pending", "all"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setShow(k)}
              className={`px-3 py-1.5 ${show === k ? "border-b-2 border-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {k === "pending" ? `Waiting (${suggestions.filter((s) => s.status === "pending").length})` : `All (${suggestions.length})`}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="border border-dashed border-border p-10 text-center text-muted-foreground">
          {show === "pending" ? "Nothing waiting." : "No suggestions yet."}
        </p>
      ) : (
        <ul className="space-y-4">
          {list.map((s) => {
            const pts =
              s.kind === "spot"
                ? s.lat != null && s.lng != null
                  ? [{ id: s.id, title: s.title, lat: s.lat, lng: s.lng }]
                  : []
                : s.items
                    .filter((i) => i.lat != null && i.lng != null)
                    .map((i, n) => ({ id: `${s.id}-${n}`, title: i.resolvedTitle, lat: i.lat as number, lng: i.lng as number }));
            const who = s.suggester.name ?? "A visitor";
            return (
              <li key={s.id} className="border border-border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {s.kind === "spot" ? "Spot" : `Walk · ${s.items.length} stops${s.preview ? ` · ${s.preview.km.toFixed(1)} km` : ""}`} · {STATUS_LABEL[s.status]}
                    </p>
                    <h3 className="font-serif text-xl">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      From{" "}
                      {s.suggester.slug && ARTDIRECT_URL ? (
                        <a href={`${ARTDIRECT_URL}/${s.suggester.slug}`} target="_blank" rel="noopener" className="underline underline-offset-4">
                          {who}
                        </a>
                      ) : (
                        who
                      )}{" "}
                      · {when(s.createdAt)}
                      {s.address ? ` · ${s.address}` : ""}
                    </p>
                  </div>
                  {s.status === "pending" && (
                    <div className="flex gap-2">
                      <button type="button" disabled={busy === s.id} onClick={() => accept(s)} className="bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                        {s.kind === "spot" ? "Accept as a place" : "Accept as a draft tour"}
                      </button>
                      <button type="button" disabled={busy === s.id} onClick={() => reject(s)} className="border border-border px-3 py-1.5 text-sm disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                  {s.status === "accepted" && (s.resultPlaceId || s.resultThreadId) && (
                    <a
                      href={s.resultThreadId ? `/manage/tours/${s.resultThreadId}` : `/manage/places/${s.resultPlaceId}`}
                      className="text-sm underline underline-offset-4"
                    >
                      Open what it became
                    </a>
                  )}
                </div>

                {s.note && <p className="mt-2 whitespace-pre-line text-sm">“{s.note}”</p>}
                {s.rejectReason && <p className="mt-2 text-sm text-muted-foreground">Rejected: {s.rejectReason}</p>}

                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  {s.kind === "route" && (
                    <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                      {s.items.map((i, n) => (
                        <li key={n}>
                          {i.resolvedTitle}
                          {"placeId" in i ? "" : " (their own spot)"}
                        </li>
                      ))}
                    </ol>
                  )}
                  {s.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photoUrl} alt="The suggester's photo" className="max-h-56 w-full border border-border bg-muted object-contain" />
                  )}
                  {pts.length > 0 && (
                    <PlacesMap places={pts} route={s.kind === "route" ? pts : undefined} legs={s.preview?.legs ?? null} activeId={s.kind === "spot" ? s.id : null} className="h-56 w-full" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
