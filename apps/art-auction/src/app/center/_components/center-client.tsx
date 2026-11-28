"use client";

import * as React from "react";
import Link from "next/link";
import type { SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { OpenFrame } from "./surfaces";

/** One row in a card's list. Plain data, so the server page can pass it. */
export interface CenterRow {
  key: string;
  title: string;
  meta: string;
  href: string;
  imageUrl?: string | null;
  badge?: { label: string; tone: "neutral" | "pending" | "success" | "destructive" } | null;
  amount?: string | null;
  /** Open this popup instead of following `href`. */
  frame?: SurfaceDescriptor | null;
}

const toneClass: Record<NonNullable<CenterRow["badge"]>["tone"], string> = {
  neutral: "bg-muted text-muted-foreground",
  pending: "bg-accent text-accent-foreground",
  success: "bg-primary text-primary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};

export function RowList({ rows, empty }: { rows: CenterRow[]; empty: React.ReactNode }) {
  if (rows.length === 0) return <p className="py-3 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.key}>
          <RowLink row={r}>
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {r.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-base">{r.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {r.badge && (
                  <span className={`inline-flex h-5 items-center rounded-full px-2 font-medium ${toneClass[r.badge.tone]}`}>
                    {r.badge.label}
                  </span>
                )}
                <span className="truncate">{r.meta}</span>
              </span>
            </span>
            {r.amount && <span className="shrink-0 text-sm tabular-nums">{r.amount}</span>}
            <span aria-hidden className="shrink-0 text-muted-foreground">›</span>
          </RowLink>
        </li>
      ))}
    </ul>
  );
}

const rowClass = "-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50";

function RowLink({ row, children }: { row: CenterRow; children: React.ReactNode }) {
  if (row.frame) return <OpenFrame frame={row.frame} className={rowClass}>{children}</OpenFrame>;
  return <Link href={row.href} className={rowClass}>{children}</Link>;
}

/** A card body with two lists behind a segmented control (Current | Past, Bids | Orders). */
export function TwoLists({
  label,
  a,
  b,
}: {
  label: string;
  a: { title: string; rows: CenterRow[]; empty: string };
  b: { title: string; rows: CenterRow[]; empty: string };
}) {
  const [which, setWhich] = React.useState<"a" | "b">("a");
  const shown = which === "a" ? a : b;
  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label={label} className="inline-flex w-fit gap-0.5 rounded-full bg-muted p-1">
        {(["a", "b"] as const).map((k) => {
          const t = k === "a" ? a : b;
          const on = which === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setWhich(k)}
              className={`min-h-9 rounded-full px-3.5 text-sm font-medium ${on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {t.title} · {t.rows.length}
            </button>
          );
        })}
      </div>
      <RowList rows={shown.rows} empty={shown.empty} />
    </div>
  );
}

/** The profile card: the market profile in front, the person on the network behind. */
export function ProfileFlip({
  name,
  line,
  place,
  initials,
  photoUrl,
  role,
  links,
}: {
  name: string;
  line: string | null;
  place: string | null;
  initials: string;
  photoUrl: string | null;
  role: string;
  links: Array<{ label: string; note: string; href: string }>;
}) {
  const [back, setBack] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);

  // Turn on hover, as IFAC's /center card does (cms-ui ProfileFlipCard). The listener sits on
  // this outer wrapper, which does not rotate, so the card cannot flicker as it turns under the
  // pointer. Only a mouse or pen turns it: on touch (including a touchscreen laptop) a tap must
  // not flip it, and the corner button and "Turn back" stay as the touch and keyboard controls.
  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    const hovers = (e: PointerEvent) => e.pointerType === "mouse" || e.pointerType === "pen";
    const enter = (e: PointerEvent) => hovers(e) && setBack(true);
    const leave = (e: PointerEvent) => hovers(e) && setBack(false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={root} className="h-full min-h-[420px] [perspective:1400px]">
      <div
        className="relative h-full min-h-[420px] transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
        style={{ transform: back ? "rotateY(180deg)" : "none" }}
      >
        <section
          aria-label="Market profile"
          aria-hidden={back}
          className="absolute inset-0 overflow-hidden rounded-xl bg-primary text-primary-foreground [backface-visibility:hidden]"
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="absolute inset-0 flex items-center justify-center font-serif text-[120px] opacity-20">
              {initials}
            </span>
          )}
          <button
            type="button"
            onClick={() => setBack(true)}
            aria-label="Turn the card"
            tabIndex={back ? -1 : 0}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-foreground"
          >
            ⟲
          </button>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-b from-transparent to-black/80 px-4 pb-4 pt-16 text-white">
            <span className="mb-1.5 w-fit rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-foreground">{role}</span>
            <h2 className="font-serif text-2xl">{name}</h2>
            {line && <p className="text-sm">{line}</p>}
            {place && <p className="text-xs text-white/80">{place}</p>}
          </div>
        </section>
        <section
          aria-label="You on the network"
          aria-hidden={!back}
          className="absolute inset-0 flex flex-col rounded-xl border border-border bg-card p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">You on the network</p>
          <ul className="mt-1 flex flex-col">
            {links.map((l) => (
              <li key={l.label} className="border-t border-border first:border-t-0">
                <a href={l.href} tabIndex={back ? 0 : -1} className="flex min-h-11 flex-col justify-center py-2 hover:underline">
                  <span className="font-medium">{l.label}</span>
                  <span className="text-xs text-muted-foreground">{l.note}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setBack(false)}
            tabIndex={back ? 0 : -1}
            className="min-h-10 w-fit rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Turn back
          </button>
        </section>
      </div>
    </div>
  );
}
