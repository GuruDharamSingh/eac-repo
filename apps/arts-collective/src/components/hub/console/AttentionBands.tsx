"use client";

import { useSurface } from "@elkdonis/cms-ui/surface";
import { cn } from "@/lib/utils";
import type { ConsoleState } from "@/lib/org-console";

/**
 * The top of the console: what is waiting on you, as bands.
 *
 * Each band is one question an owner actually asks — what have I not finished,
 * who is coming, who is waiting on an answer, who just arrived — with the count
 * as the answer and a way in. Bands with nothing pending stay quiet rather than
 * disappearing: "0 drafts" is information, and a band that vanishes when empty
 * makes the console's shape change under you between visits.
 *
 * Hierarchy is carried by the band, not by heading size. Everything on the old
 * Organization tab was `font-serif text-2xl` with a muted caption, so seven
 * unrelated sections read as equally urgent — which is the same as none of them
 * being urgent.
 *
 * A band OPENS A SURFACE rather than navigating. The detail it shows was
 * already loaded with the page, so there is no route to invent, nothing to
 * fetch on click, and no way for a band to promise a page that does not exist.
 */

export const CONSOLE_SURFACES = {
  drafts: "console-drafts",
  schedule: "console-schedule",
  responses: "console-responses",
  people: "console-people",
  settings: "console-settings",
} as const;

type Band = {
  id: string;
  label: string;
  count: number;
  /** Reads under the number, finishing the sentence the count starts. */
  reading: string;
  surfaceKey: string;
  linkLabel: string;
  /** Pending work — draws the eye. Idle bands stay flat. */
  active: boolean;
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function AttentionBands({
  state,
  orgHomeUrl,
}: {
  state: ConsoleState;
  orgHomeUrl: string;
}) {
  const surface = useSurface();
  const quiet = daysSince(state.published.lastAt);

  const bands: Band[] = [
    {
      id: "drafts",
      label: "Unfinished",
      count: state.drafts.count,
      reading: state.drafts.count
        ? `${plural(state.drafts.count, "draft", "drafts")} written, not published`
        : "nothing waiting to be finished",
      surfaceKey: CONSOLE_SURFACES.drafts,
      linkLabel: "Open drafts",
      active: state.drafts.count > 0,
    },
    {
      id: "schedule",
      label: "Coming up",
      count: state.upcoming.count,
      reading: state.upcoming.count
        ? `${plural(state.upcoming.count, "date", "dates")} · ${state.upcoming.rsvpTotal} ${plural(state.upcoming.rsvpTotal, "RSVP", "RSVPs")}`
        : "nothing on the calendar",
      surfaceKey: CONSOLE_SURFACES.schedule,
      linkLabel: "See the schedule",
      active: state.upcoming.count > 0,
    },
    {
      id: "responses",
      label: "Waiting on you",
      count: state.responses.count,
      reading: state.responses.count
        ? `${plural(state.responses.count, "answer", "answers")} submitted, unread`
        : "no unread answers",
      surfaceKey: CONSOLE_SURFACES.responses,
      linkLabel: "Read answers",
      active: state.responses.count > 0,
    },
    {
      id: "people",
      label: "People",
      count: state.people.total,
      reading: state.people.waiting.length
        ? `${state.people.waiting.length} ${plural(state.people.waiting.length, "person has", "people have")} no role yet`
        : state.people.recent.length
          ? `${state.people.recent.length} joined in the last 30 days`
          : `${plural(state.people.total, "member", "members")}, none new`,
      surfaceKey: CONSOLE_SURFACES.people,
      linkLabel: "Manage people",
      active: state.people.waiting.length > 0,
    },
  ];

  return (
    <section aria-label="What needs attention" className="mb-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          What needs you
        </h2>
        <p className="text-xs text-muted-foreground">
          {state.published.count} published
          {quiet !== null && quiet > 42 && (
            <>
              {" · "}
              <span className="text-primary">
                nothing new in {Math.floor(quiet / 7)} weeks
              </span>
            </>
          )}
          {" · "}
          <a
            href={orgHomeUrl}
            target="_blank"
            rel="noopener"
            className="underline underline-offset-4 hover:text-foreground"
          >
            view the site ↗
          </a>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {bands.map((band) => (
          <button
            key={band.id}
            type="button"
            // The face hands over its own element, which is what lets the
            // surface grow out of the band rather than just appearing.
            onClick={(e) =>
              surface.open(
                { type: "custom", key: band.surfaceKey, title: band.label, size: "wide" },
                e.currentTarget
              )
            }
            className={cn(
              "group flex flex-col justify-between gap-3 rounded-lg border p-4 text-left transition",
              band.active
                ? "border-primary/40 bg-accent/40 hover:border-primary/70"
                : "border-border bg-card hover:border-foreground/25"
            )}
          >
            <div>
              <p
                className={cn(
                  "text-xs uppercase tracking-wider",
                  band.active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {band.label}
              </p>
              <p
                className={cn(
                  "mt-2 font-serif text-3xl leading-none",
                  band.count === 0 ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {band.count}
              </p>
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                {band.reading}
              </p>
            </div>
            <span className="text-xs text-muted-foreground underline-offset-4 group-hover:underline">
              {band.linkLabel} →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
