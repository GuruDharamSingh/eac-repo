"use client";

import * as React from "react";
import { RichTextEditor } from "../editor";
import { coverFrameStyle } from "../files";
import type { SeriesPlannerCover } from "./SeriesPlannerSurface";

/**
 * The organisation's public Series page, edited from the hub (2026-10-18;
 * mockup E, docs/open/series-index-mockups-2026-10-18/e-editing.html): the
 * eyebrow, heading and introduction at the top of /series, the order of the
 * series, and which one is featured (first on /series and the landing
 * page). Each series' own card (cover, description, colour, listed) is
 * edited in its planner.
 *
 * Reads and writes one endpoint (IFAC: `/api/hub/series-page`), which
 * enforces who may write. Styles: `.eac-series*` and `.eac-spage*` in
 * surface.css, the planner's own.
 */

export interface SeriesPageEditorSeries {
  id: string;
  title: string;
  href: string;
  plannerHref: string;
  cover: SeriesPlannerCover | null;
  accent: string;
  listed: boolean;
  featured: boolean;
  ended: boolean;
  upcoming: boolean;
  published: number;
}

interface Loaded {
  settings: { eyebrow: string; heading: string; introHtml: string; order: string[]; featuredId: string | null };
  canEdit: boolean;
  series: SeriesPageEditorSeries[];
}

function emptyHtml(html: string): boolean {
  return html.replace(/<p>(\s|<br\s*\/?>)*<\/p>/gi, "").trim() === "";
}

export function SeriesPageEditor({
  endpoint = "/api/hub/series-page",
  publicHref = "/series",
  defaultHeading = "Series",
}: {
  endpoint?: string;
  publicHref?: string;
  /** What the page shows when the heading is left empty. */
  defaultHeading?: string;
}) {
  const [data, setData] = React.useState<Loaded | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [eyebrow, setEyebrow] = React.useState("");
  const [heading, setHeading] = React.useState("");
  const [intro, setIntro] = React.useState("");
  const [introTouched, setIntroTouched] = React.useState(false);
  const [order, setOrder] = React.useState<string[]>([]);
  const [featured, setFeatured] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setProblem(body.error ?? "Could not load the Series page.");
      const d = body as Loaded;
      setData(d);
      setEyebrow(d.settings.eyebrow);
      setHeading(d.settings.heading);
      setIntro(d.settings.introHtml);
      setIntroTouched(false);
      setOrder(d.series.map((x) => x.id));
      setFeatured(d.settings.featuredId);
    } catch {
      setProblem("Could not reach the server.");
    }
  }, [endpoint]);
  React.useEffect(() => {
    void load();
  }, [load]);

  if (problem) return <p className="eac-series__hint" role="alert">{problem}</p>;
  if (!data) return <p className="eac-rota-intro">Loading the Series page…</p>;

  const byId = new Map(data.series.map((x) => [x.id, x]));
  const listed = order.map((id) => byId.get(id)).filter((x): x is SeriesPageEditorSeries => Boolean(x));
  const dirty =
    eyebrow !== data.settings.eyebrow ||
    heading !== data.settings.heading ||
    (introTouched && intro !== data.settings.introHtml) ||
    JSON.stringify(order) !== JSON.stringify(data.series.map((x) => x.id)) ||
    featured !== data.settings.featuredId;
  const edit = data.canEdit;

  function move(i: number, by: number) {
    setOrder((o) => {
      const j = i + by;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setStatus("Saving…");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eyebrow, heading, ...(introTouched ? { introHtml: intro } : {}), order, featuredId: featured }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(null);
        setProblem(body.error ?? "Could not save.");
        return;
      }
      setStatus("Saved");
      await load();
    } catch {
      setStatus("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="eac-spage eac-spage__split">
      <div className="eac-spage__form eac-series__form">
        <p className="eac-rota-intro">
          The top of the public Series page and the order of the series on it. Each series&apos; card (cover, description,
          colour, listed or not) is set in that series&apos; planner.
        </p>
        <div className="eac-series__pair">
          <label className="eac-series__field">
            <span>Eyebrow</span>
            <input className="eac-input" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} maxLength={80} disabled={!edit} />
          </label>
          <label className="eac-series__field">
            <span>Heading</span>
            <input className="eac-input" value={heading} onChange={(e) => setHeading(e.target.value)} maxLength={160} disabled={!edit} placeholder={defaultHeading} />
          </label>
        </div>
        <div className="eac-series__field">
          <span>Introduction</span>
          {edit ? (
            <RichTextEditor
              value={intro}
              onChange={(html) => {
                setIntroTouched(true);
                setIntro(emptyHtml(html) ? "" : html);
              }}
              toolbar="minimal"
              minHeight={160}
              ariaLabel="Introduction to the Series page"
              placeholder="What the organisation offers in its series, who they are for, what is coming."
            />
          ) : (
            <div className="eac-series__rich" dangerouslySetInnerHTML={{ __html: intro || "<p>No introduction yet.</p>" }} />
          )}
        </div>

        <p className="eac-series__section">Series on the page</p>
        {listed.length === 0 ? (
          <p className="eac-rota__plan-empty">No series yet. Make one in Compose: “Series”.</p>
        ) : (
          <ol className="eac-spage__list">
            {listed.map((x, i) => {
              const still = x.cover ? (x.cover.kind === "image" ? x.cover.url : x.cover.posterUrl ?? null) : null;
              const state = x.ended ? "Ended" : x.upcoming ? "Starting soon" : "Running";
              return (
                <li key={x.id} className={`eac-spage__item${x.listed ? "" : " is-hidden"}`}>
                  <span className="eac-spage__dot" style={{ background: x.accent }} aria-hidden="true" />
                  <span className="eac-series__thumb" aria-hidden="true">
                    {still ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={still} alt="" style={x.cover?.kind === "image" ? coverFrameStyle(x.cover.frame) : { objectFit: "cover" }} />
                    ) : null}
                  </span>
                  <span className="eac-spage__name">
                    <a href={x.plannerHref}>{x.title}</a>
                    <small>
                      {state} · {x.published} coming {x.published === 1 ? "session" : "sessions"} published
                      {x.listed ? "" : " · not listed"}
                    </small>
                  </span>
                  {edit && (
                    <span className="eac-spage__tools">
                      <label className="eac-spage__feat">
                        <input type="radio" name="eac-spage-featured" checked={featured === x.id} onChange={() => setFeatured(x.id)} />
                        Featured
                      </label>
                      <button type="button" className="eac-face-tool" aria-label={`Move ${x.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button type="button" className="eac-face-tool" aria-label={`Move ${x.title} down`} disabled={i === listed.length - 1} onClick={() => move(i, 1)}>↓</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {edit && featured && (
          <button type="button" className="eac-rota__plan-edit" onClick={() => setFeatured(null)}>
            No featured series
          </button>
        )}
        <p className="eac-series__hint">Ended series move to “Earlier series” at the foot of the page by themselves. Hidden series are kept here so they can be listed again from their planner.</p>

        <div className="eac-rota__record-actions">
          {edit && (
            <button type="button" className="eac-face-tool eac-rota__save" disabled={!dirty || busy} onClick={() => void save()}>
              {busy ? "Saving…" : dirty ? "Save the Series page" : "Saved"}
            </button>
          )}
          <a className="eac-face-tool" href={publicHref} target="_blank" rel="noreferrer">Open the Series page</a>
          {status && <span className="eac-series__hint" role="status">{status}</span>}
        </div>
      </div>

      <aside className="eac-spage__prev" aria-label="Preview">
        <div className="eac-cardprev">
          <p className="eac-cardprev__k">Preview · top of the Series page</p>
          <span className="eac-cardprev__eyebrow">{eyebrow || "Series"}</span>
          <span className="eac-cardprev__h">{heading || defaultHeading}</span>
          {intro && <div className="eac-cardprev__intro" dangerouslySetInnerHTML={{ __html: intro }} />}
          <div className="eac-spage__prevgrid">
            {listed
              .filter((x) => x.listed && !x.ended)
              .sort((p, q) => (p.id === featured ? -1 : q.id === featured ? 1 : 0))
              .map((x) => {
                const still = x.cover ? (x.cover.kind === "image" ? x.cover.url : x.cover.posterUrl ?? null) : null;
                return (
                  <div key={x.id} className="eac-cardprev__card" style={{ "--cp-acc": x.accent, "--cp-acc-text": x.accent } as React.CSSProperties}>
                    <span className="eac-cardprev__media">
                      <span className="eac-cardprev__cover">
                        {still ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={still} alt="" style={x.cover?.kind === "image" ? coverFrameStyle(x.cover.frame) : { objectFit: "cover" }} />
                        ) : null}
                      </span>
                    </span>
                    <span className="eac-cardprev__body">
                      <span className="eac-cardprev__t">{x.title}</span>
                      {x.id === featured && <span className="eac-cardprev__rhythm"><i aria-hidden="true" />Featured</span>}
                    </span>
                  </div>
                );
              })}
          </div>
          <p className="eac-cardprev__intro">Below the cards: every session, as a list or a calendar.</p>
        </div>
      </aside>
    </div>
  );
}
