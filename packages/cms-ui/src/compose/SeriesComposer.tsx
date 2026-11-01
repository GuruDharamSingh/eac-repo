"use client";

import * as React from "react";
import { ContentComposer, type ContentComposerSlots } from "./ContentComposer";
import type { ContentFieldContext } from "./content-fields";
import { seriesCardLines } from "./series-card";

// ============================================================================
// The series card (2026-10-10; mockup docs/open/series-mockups-2026-10-10/
// 02-series-timeline.html, variant A, top part).
//
// A series is composed as the card the site shows: the cover and a live
// preview of how the card reads on one side, the fields that make it on the
// other. The fields are the shared list (`content-fields.ts`, kind
// `series`), rendered by ContentComposer in two passes: the card's groups
// inside the card, and "Where it goes" under it. The weeks themselves (host,
// title, write-up, cover, materials) are the planner's, so this ends with a
// note saying so rather than drawing the week squares.
// ============================================================================

const CARD_GROUPS = ["series-identity", "series-schedule", "series-joining", "series-display"];
const AFTER_GROUPS = ["placement"];

export interface SeriesComposerProps {
  context?: ContentFieldContext;
  answers: Record<string, unknown>;
  onChange: (answers: Record<string, unknown>) => void;
  slots?: ContentComposerSlots;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Printed in the card's kicker: "Weekly series · IFAC". */
  orgName?: string;
}

export function SeriesComposer({ context, answers, onChange, slots, fieldErrors, orgName }: SeriesComposerProps) {
  const lines = seriesCardLines(answers, { orgName });
  const cover = typeof answers.cover_image_url === "string" ? answers.cover_image_url : "";
  const editing = answers.series_editing === true;

  return (
    <div className="eac-series-compose" data-kind="series">
      <p className="eac-series-compose__label">
        Series card <small>Shown at the top of the series page and on the home page</small>
      </p>

      <section className="eac-series-card" aria-label="Series card">
        <div className="eac-series-card__face">
          <div className="eac-series-card__cover">
            {slots?.media ? (
              slots.media({
                value: cover,
                onChange: (value) => onChange({ ...answers, cover_image_url: value }),
                label: "Cover image",
                hint: "A week without its own cover uses this one.",
              })
            ) : cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" />
            ) : null}
            {fieldErrors?.cover_image_url?.length ? (
              <p className="eac-field-error">{fieldErrors.cover_image_url.join(". ")}</p>
            ) : null}
          </div>

          <div className="eac-series-card__promo" aria-label="How the card reads on the site" data-series-preview>
            <p className="eac-series-card__kicker">{lines.kicker}</p>
            <p className="eac-series-card__title">{lines.title || <span className="is-empty">Series title</span>}</p>
            <p className="eac-series-card__when">{lines.when || <span className="is-empty">Day and time</span>}</p>
            {lines.span ? (
              <p className="eac-series-card__span">
                {lines.span}
                {lines.sessions ? ` · ${lines.sessions} ${lines.sessions === 1 ? "session" : "sessions"}` : ""}
              </p>
            ) : null}
            <p className="eac-series-card__note">Preview: updates as the fields change.</p>
          </div>
        </div>

        <div className="eac-series-card__body">
          <ContentComposer
            kind="series"
            context={context}
            answers={answers}
            onChange={onChange}
            slots={slots}
            fieldErrors={fieldErrors}
            groups={CARD_GROUPS}
            omit={["cover_image_url"]}
          />
        </div>
      </section>

      {editing ? null : (
        <p className="eac-series-compose__next" data-series-next>
          After saving, you&apos;ll plan each week (host, title, write-up, cover, materials) in the series planner.
        </p>
      )}

      <ContentComposer
        kind="series"
        context={context}
        answers={answers}
        onChange={onChange}
        slots={slots}
        fieldErrors={fieldErrors}
        groups={AFTER_GROUPS}
      />
    </div>
  );
}
