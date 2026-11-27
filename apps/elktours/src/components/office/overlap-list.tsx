"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { dismissAllOverlaps, dismissOverlap } from "@/lib/overlap-actions";
import type { Overlap, OverlapSide } from "@/lib/slot-overlaps";
import { formatDay, parisDayOf, parisTimeOf } from "@/lib/schedule-plan";

const dayLabel = (iso: string) => formatDay(parisDayOf(iso), { weekday: "short", day: "numeric", month: "short" });

function Side({ s }: { s: OverlapSide }) {
  return (
    <Link href={`/manage/schedule/${s.slotId}`} className="block underline-offset-4 hover:underline">
      <span className="tabular-nums">
        {parisTimeOf(s.startsAt)}–{parisTimeOf(s.endsAt)}
      </span>{" "}
      {s.tourTitle}
    </Link>
  );
}

/**
 * The overlap notices (lib/slot-overlaps.ts): two runs of one guide that overlap in time. They were published
 * anyway; each notice stays until dismissed. Used by the hub popup and by /manage/overlaps.
 */
export function OverlapList({ initial, onChange }: { initial: Overlap[]; onChange?: (left: number) => void }) {
  const [items, setItems] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function dismiss(o: Overlap) {
    setBusy(true);
    const r = await dismissOverlap(o.a.slotId, o.b.slotId).catch(() => ({ ok: false as const, error: "Could not dismiss it." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    const next = items.filter((x) => x.key !== o.key);
    setItems(next);
    onChange?.(next.length);
  }

  async function dismissAll() {
    setBusy(true);
    const r = await dismissAllOverlaps().catch(() => ({ ok: false as const, error: "Could not dismiss them." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    setItems([]);
    onChange?.(0);
  }

  if (items.length === 0) return <p className="text-sm text-muted-foreground">No overlapping runs to look at.</p>;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        These runs overlap another run of the same guide. They were published anyway. Cancel or move one from its page, or dismiss the notice if it is intended.
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((o) => (
          <li key={o.key} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">
                {dayLabel(o.a.startsAt)}
                {o.guideName ? <span className="font-normal text-muted-foreground"> · {o.guideName}</span> : null}
              </p>
              <Side s={o.a} />
              <Side s={o.b} />
            </div>
            <button type="button" disabled={busy} onClick={() => dismiss(o)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/60 disabled:opacity-40">
              Dismiss
            </button>
          </li>
        ))}
      </ul>
      {items.length > 1 ? (
        <button type="button" disabled={busy} onClick={dismissAll} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/60 disabled:opacity-40">
          Dismiss all {items.length}
        </button>
      ) : null}
    </div>
  );
}
