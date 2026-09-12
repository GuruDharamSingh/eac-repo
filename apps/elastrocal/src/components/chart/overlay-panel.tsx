"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ASPECT_BY_KEY,
  formatPosition,
  synastryAspects,
  transitAspects,
  type ChartResult,
  type CrossAspect,
} from "@elkdonis/astro";
import { ChartWheel, SkyControls, SkyHeader, useSky } from "@/components/sky";
import {
  AspectsTable,
  ChartSummary,
  HousesTable,
  PointGlyph,
  PositionsTable,
  pointName,
} from "./tables";
import { cn } from "@/lib/utils";

/**
 * A saved chart, with an optional second chart laid over it.
 *
 * One control, two overlays, because they are the same gesture and the same
 * drawing — a bi-wheel, this chart inside and keeping its houses, something
 * else ringing it:
 *
 *   Transits   the moving sky. The time controls drive the outer ring only;
 *              step or play it and the natal chart underneath never moves.
 *              Contacts are tight (3°) and say whether they are applying.
 *   Compare    another saved chart — synastry. Neither chart moves, so there
 *              is no applying/separating to show, and the orbs are wider (5°).
 *
 * Comparison is a URL (`?compare=<id>`) rather than client state: the second
 * chart has to be read from the database under the same keeper scoping as the
 * first — a chart id alone must never fetch a row — and a comparison worth
 * looking at is worth being able to link to.
 */

type Overlay = "none" | "transits";

export function OverlayPanel({
  natal,
  natalName,
  initialIso,
  initialTransit,
  others,
  compare,
}: {
  natal: ChartResult;
  natalName: string;
  initialIso: string;
  initialTransit: ChartResult;
  /** The keeper's other saved charts, for the compare menu. */
  others: Array<{ id: string; name: string }>;
  /** The chart named by ?compare=, already loaded and scoped. */
  compare: { id: string; name: string; chart: ChartResult } | null;
}) {
  const router = useRouter();
  const [overlay, setOverlay] = useState<Overlay>("none");
  const sky = useSky(initialIso, initialTransit, true);

  // A comparison in the URL wins: the page was asked for it explicitly.
  const mode = compare ? "compare" : overlay;
  const outer = compare ? compare.chart : mode === "transits" ? sky.chart : undefined;

  const contacts: CrossAspect[] = compare
    ? synastryAspects(natal, compare.chart)
    : mode === "transits"
      ? transitAspects(natal, sky.chart)
      : [];

  const choose = (value: string) => {
    if (value === "transits" || value === "none") {
      setOverlay(value);
      if (value !== "transits") sky.setPlaying(null);
      if (compare) router.push("?");
      return;
    }
    setOverlay("none");
    sky.setPlaying(null);
    router.push(`?compare=${value}`);
  };

  return (
    <div className="space-y-6">
      {natal.warnings.length > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-accent-foreground">
          {natal.warnings.join(" ")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">Overlay</span>
              <select
                value={compare ? compare.id : overlay}
                onChange={(e) => choose(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="none">Nothing</option>
                <option value="transits">Transits — the sky now</option>
                {others.length > 0 && (
                  <optgroup label="Compare with">
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            {outer && (
              <span className="text-xs text-muted-foreground">
                {contacts.length} {compare ? "interaspects" : "contacts"}
              </span>
            )}
          </div>

          {/* Which ring is whose. Inner/outer is not a convention a reader can
              rely on — software disagrees — so the wheel says it outright. */}
          {outer && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-[#231e2b]" aria-hidden />
                Inner: {natalName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-[#4a3f7a]" aria-hidden />
                Outer: {compare ? compare.name : "the sky"}
              </span>
              <span className="text-muted-foreground">Houses are {natalName}’s</span>
            </div>
          )}

          {mode === "transits" && <SkyHeader sky={sky} className="text-[13px]" />}

          <ChartWheel chart={natal} transits={outer} />

          {mode === "transits" ? (
            <SkyControls sky={sky} />
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {compare
                ? `${natalName} within, ${compare.name} around`
                : new Date(natal.utc).toUTCString().replace("GMT", "UTC")}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {outer && (
            <ContactsTable
              contacts={contacts}
              synastry={Boolean(compare)}
              outerName={compare ? compare.name : "transiting"}
              innerName={natalName}
            />
          )}
          <ChartSummary chart={natal} />
          <PositionsTable chart={natal} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <HousesTable chart={natal} />
        <AspectsTable chart={natal} />
      </div>
    </div>
  );
}

/**
 * The contacts, outer point first, tightest first.
 *
 * Applying/separating appears only for transits. Between two birth charts
 * nothing is moving, so the column would be a lie — the engine's `applying`
 * flag is undefined in meaning there and deliberately not read.
 */
function ContactsTable({
  contacts,
  synastry,
  outerName,
  innerName,
}: {
  contacts: CrossAspect[];
  synastry: boolean;
  outerName: string;
  innerName: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/80 p-5">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        {synastry ? "Interaspects" : "Transits"}
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {synastry
          ? `${outerName}’s planets to ${innerName}’s, within 5°. Read the tightest first.`
          : "Moving planet to natal point, within 3°. A solid line on the wheel is applying."}
      </p>
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing within orb.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {contacts.map((c) => (
            <li key={`${c.moving}-${c.type}-${c.fixed}`} className="flex items-center gap-2">
              <PointGlyph k={c.moving} />
              <span className="text-muted-foreground" title={ASPECT_BY_KEY[c.type].name}>
                {ASPECT_BY_KEY[c.type].glyph}
              </span>
              <PointGlyph k={c.fixed} />
              <span className="min-w-0 flex-1 truncate">
                {pointName(c.moving)} {ASPECT_BY_KEY[c.type].name.toLowerCase()}{" "}
                {synastry ? "" : "natal "}
                {pointName(c.fixed)}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {formatPosition(c.orb, "degree")}
              </span>
              {!synastry && (
                <span
                  className={cn(
                    "w-16 shrink-0 text-right text-xs",
                    c.applying ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {c.applying ? "applying" : "separating"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
