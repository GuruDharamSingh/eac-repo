"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Checkbox, Label, Textarea } from "@elkdonis/primitives";
import type { RenderRequest, RenderStyle, RenderStyleInput } from "@/lib/catalogue-types";
import { cancelFlyoverAction, requestFlyoverAction } from "@/lib/render-request-actions";
import { FlyoverTimeline, STATUS_LABEL, fmtWhen } from "@/components/manage/flyover-status";

const OPEN: RenderRequest["status"][] = ["requested", "accepted", "claimed", "rendering"];
const TIMES: Array<{ value: NonNullable<RenderStyle["timeOfDay"]>; label: string }> = [
  { value: "day", label: "Day" },
  { value: "golden", label: "Golden hour" },
  { value: "dusk", label: "Dusk" },
];
const ASPECTS: NonNullable<RenderStyle["aspect"]> = ["16:9", "9:16", "1:1"];

/**
 * /manage/tours/[id]/flyover: the open request's lifecycle, the request form
 * (style hints only; the camera, route line and the 30 s limit are fixed by
 * the server) and the history. Editors request; owners accept on
 * /manage/flyovers. A delivered film lands hidden in the Assets tab.
 */
export function FlyoverPanel({
  tourId,
  stops,
  requests,
  canAccept,
  renderable,
}: {
  tourId: string;
  stops: Array<{ id: string; title: string; hasCoords: boolean }>;
  requests: RenderRequest[];
  canAccept: boolean;
  /** Why a fly-over can't be requested yet (no route, under two stops), or null. */
  renderable: string | null;
}) {
  const router = useRouter();
  const open = requests.find((r) => OPEN.includes(r.status)) ?? null;
  const history = requests.filter((r) => r !== open);

  // Poll while something is moving, so the timeline advances without a reload.
  React.useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => router.refresh(), 15000);
    return () => window.clearInterval(t);
  }, [open, router]);

  async function cancel(r: RenderRequest) {
    if (!confirm("Cancel this fly-over request?")) return;
    const res = await cancelFlyoverAction(r.id).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    if (!res.ok) return void toast.error(res.error);
    toast.success("Request cancelled.");
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <section>
        <h3 className="font-serif text-lg">Current request</h3>
        {open ? (
          <div className="mt-3 border border-border p-4">
            <p className="text-sm">
              <span className="font-medium">{STATUS_LABEL[open.status]}</span>
              <span className="text-muted-foreground">
                {" "}· asked by {open.requestedByName ?? "an editor"} on {fmtWhen(open.createdAt)}
              </span>
            </p>
            <div className="mt-4">
              <FlyoverTimeline request={open} />
            </div>
            <StyleSummary style={open.style} note={open.note} stops={stops} />
            <div className="mt-4 flex flex-wrap gap-3">
              {(open.status === "requested" || open.status === "accepted") && (
                <Button type="button" size="sm" variant="outline" onClick={() => cancel(open)}>
                  Cancel request
                </Button>
              )}
              {canAccept && open.status === "requested" && (
                <Button asChild size="sm">
                  <Link href="/manage/flyovers">Review in the queue</Link>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <RequestForm tourId={tourId} stops={stops} renderable={renderable} onDone={() => router.refresh()} />
        )}
      </section>

      <section>
        <h3 className="font-serif text-lg">History</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No earlier fly-overs for this tour.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border border-border">
            {history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-medium">{STATUS_LABEL[r.status]}</span>
                  {r.rejectedReason && <span className="text-muted-foreground"> · {r.rejectedReason}</span>}
                  {r.status === "failed" && r.error && <span className="text-muted-foreground"> · {r.error}</span>}
                </span>
                <span className="text-muted-foreground">
                  {fmtWhen(r.createdAt)}
                  {r.finishedAt ? ` → ${fmtWhen(r.finishedAt)}` : ""}
                  {r.status === "delivered" && r.deliveredAssetIds.length > 0 && (
                    <>
                      {" "}·{" "}
                      <Link href={`/manage/tours/${tourId}/assets`} className="underline underline-offset-4">
                        see in Assets
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StyleSummary({ style, note, stops }: { style: RenderStyle; note: string | null; stops: Array<{ id: string; title: string }> }) {
  const emph = (style.emphasizeStopIds ?? []).map((id) => stops.find((s) => s.id === id)?.title).filter(Boolean);
  const bits = [
    style.timeOfDay ? TIMES.find((t) => t.value === style.timeOfDay)?.label : null,
    style.aspect?.length ? style.aspect.join(", ") : null,
    emph.length ? `linger on ${emph.join(", ")}` : null,
  ].filter(Boolean);
  if (!bits.length && !note && !style.notes) return null;
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      {bits.join(" · ")}
      {(style.notes || note) && <span className="block italic">“{style.notes ?? note}”</span>}
    </p>
  );
}

function RequestForm({
  tourId,
  stops,
  renderable,
  onDone,
}: {
  tourId: string;
  stops: Array<{ id: string; title: string; hasCoords: boolean }>;
  renderable: string | null;
  onDone: () => void;
}) {
  const [timeOfDay, setTimeOfDay] = React.useState<RenderStyleInput["timeOfDay"]>("day");
  const [aspect, setAspect] = React.useState<NonNullable<RenderStyle["aspect"]>>(["16:9"]);
  const [emphasize, setEmphasize] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await requestFlyoverAction(tourId, {
      style: { timeOfDay, aspect: aspect.length ? aspect : ["16:9"], emphasizeStopIds: emphasize, notes: notes.trim() || undefined },
    }).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "Failed" }));
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Fly-over requested. An owner accepts it from the queue.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 max-w-2xl space-y-5 border border-border p-4">
      <p className="text-sm text-muted-foreground">
        A ≤30 second aerial film of the route over Google 3D tiles, rendered on the studio PC. The camera and route line are the
        house style; these are hints. The film arrives hidden in Assets until you switch it on.
      </p>
      {renderable && <p className="text-sm text-amber-700">{renderable}</p>}

      <fieldset>
        <legend className="text-sm font-medium">Light</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {TIMES.map((t) => (
            <label key={t.value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="timeOfDay" checked={timeOfDay === t.value} onChange={() => setTimeOfDay(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Formats</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {ASPECTS.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={aspect.includes(a)}
                onCheckedChange={(v) => setAspect((list) => (v ? [...list, a] : list.filter((x) => x !== a)))}
              />
              {a}
              {a === "16:9" ? " (site)" : a === "9:16" ? " (stories)" : ""}
            </label>
          ))}
        </div>
      </fieldset>

      {stops.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium">Linger on</legend>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {stops
              .filter((s) => s.hasCoords)
              .map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={emphasize.includes(s.id)}
                    onCheckedChange={(v) => setEmphasize((list) => (v ? [...list, s.id] : list.filter((x) => x !== s.id)))}
                  />
                  {s.title}
                </label>
              ))}
          </div>
        </fieldset>
      )}

      <div>
        <Label htmlFor="flyover-notes">Notes for the render</Label>
        <Textarea id="flyover-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1" maxLength={1000} />
      </div>

      <Button type="submit" disabled={busy || Boolean(renderable)}>
        {busy ? "Requesting…" : "Request fly-over"}
      </Button>
    </form>
  );
}
