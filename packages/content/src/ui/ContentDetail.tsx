"use client";

import * as React from "react";
import { ArrowLeftRight, CalendarDays, ExternalLink, PenLine } from "lucide-react";
import { SurfaceFrame, useLayer } from "@elkdonis/cms-ui/surface";
import { fmtDayLong, groupTimeline, panelOf, type ContentDetailModel, type ContentEvent } from "../model";
import { STATUS_WORD, typeGlyph, typeLabel, typeMeta } from "../registry";
import { AppLink, ConnectorsCtx, type ContentDetailConnectors } from "./connectors";
import { IdentityMark, NextChip, Thumb, Timeline } from "./atoms";
import { CoveragePanel } from "./panels/coverage";
import { PlanPanel } from "./panels/plan";

export type ContentDetailTab = "overview" | "plan";

export interface ContentDetailProps {
  /** null: the item could not be found (the host's words go in `notFound`). */
  model: ContentDetailModel | null;
  connectors: ContentDetailConnectors;
  /** Pass 1 has the pop-up only; "page" and "sheet" come with later passes. */
  layout?: "popup";
  initialTab?: ContentDetailTab;
  /** Mirror the tab into `?tab=plan` while this layer is on top (Channel's address). */
  tabInAddress?: boolean;
  notFound?: string;
}

function Actions({ model, connectors }: { model: ContentDetailModel; connectors: ContentDetailConnectors }) {
  return (
    <div className="chn-actions">
      {model.links.compose && (
        <AppLink className="chn-btn is-primary" href={model.links.compose}>
          <PenLine size={15} aria-hidden /> New post
        </AppLink>
      )}
      {model.links.board && (
        <AppLink className="chn-btn" href={model.links.board}>
          <CalendarDays size={15} aria-hidden /> Board
        </AppLink>
      )}
      {model.links.studio && (
        <a className="chn-btn" href={model.links.studio}>
          <ExternalLink size={15} aria-hidden /> Open in Studio
        </a>
      )}
      {model.links.public && (
        <a className="chn-link" href={model.links.public} target="_blank" rel="noreferrer">
          View on {model.site.name === "Your page" ? "your page" : model.site.name} ↗
        </a>
      )}
      {connectors.switchItem && (
        <button type="button" className="chn-linkbtn chn-ps-switch" onClick={() => connectors.switchItem!(model.key)}>
          <ArrowLeftRight size={14} aria-hidden /> Switch piece
        </button>
      )}
    </div>
  );
}

/** Media, kind, title, status, then the actions. */
function PieceHeader({ model, connectors }: { model: ContentDetailModel; connectors: ContentDetailConnectors }) {
  const status = model.status.value;
  const known = status in STATUS_WORD;
  return (
    <header className="eac-c-pvh">
      <Thumb cover={model.media.cover} type={model.type} size={112} />
      <div className="eac-c-pvh-main">
        <p className="chn-kicker">
          {typeGlyph(model.type)} {typeLabel(model.type)}
        </p>
        <div className="eac-c-pvh-title">
          <h2>{model.title}</h2>
          <span className="eac-c-chip" data-state={known ? status : undefined}>
            {known ? STATUS_WORD[status as keyof typeof STATUS_WORD] : model.status.label}
          </span>
        </div>
        <p className="eac-c-pvh-meta">{model.meta}</p>
        <Actions model={model} connectors={connectors} />
      </div>
    </header>
  );
}

/** The history in three groups: Ahead (booked), Now (live or the last day), Past. */
function PieceHistory({ model }: { model: ContentDetailModel }) {
  const g = groupTimeline(model.timeline, model.now);
  const list = (events: ContentEvent[]) => <Timeline events={events} identities={model.identities} timeZone={model.timeZone} showIdentity />;
  if (!g.ahead.length && !g.now.length && !g.past.length) return <p className="chn-quiet">Nothing has gone out yet.</p>;
  return (
    <div className="eac-c-pvg-all">
      {g.ahead.length > 0 && (
        <section className="eac-c-pvg" data-g="ahead">
          <h3>Ahead</h3>
          {list(g.ahead)}
        </section>
      )}
      {g.now.length > 0 && (
        <section className="eac-c-pvg" data-g="now">
          <h3>Now · {fmtDayLong(model.now, model.timeZone)}</h3>
          {list(g.now)}
        </section>
      )}
      {g.past.length > 0 && (
        <section className="eac-c-pvg" data-g="past">
          <h3>Past</h3>
          {list(g.past)}
        </section>
      )}
    </div>
  );
}

/**
 * The content detail, pop-up layout (lifted from Channel's PieceSurface, 3a +
 * 3c). On Overview: a header (media, kind, title, status), the history as
 * Ahead / Now / Past above the tabs, then coverage by identity and what is
 * next. The Plan tab keeps the old masthead (meta and actions) over plan.md
 * and the board's waiting suggestions.
 */
export function ContentDetail({ model, connectors, initialTab = "overview", tabInAddress = false, notFound = "This item could not be found." }: ContentDetailProps) {
  const [tab, setTab] = React.useState<ContentDetailTab>(initialTab);
  const layer = useLayer();

  React.useEffect(() => {
    if (model) layer.setMeta({ title: model.title });
  }, [model, layer]);

  React.useEffect(() => {
    // Only the top layer owns the address (an item beneath the library does not).
    if (!tabInAddress || !layer.isTop) return;
    const u = new URL(window.location.href);
    if (tab === "plan") u.searchParams.set("tab", "plan");
    else u.searchParams.delete("tab");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }, [tab, layer.isTop, tabInAddress]);

  if (!model) {
    return (
      <SurfaceFrame kind="neutral" title="Not found">
        <p className="chn-quiet">{notFound}</p>
      </SurfaceFrame>
    );
  }

  const owner = model.owner;
  const presenter = model.presentedBy;
  const coverage = panelOf(model, "coverage");
  const planData = panelOf(model, "plan");
  const suggestions = planData?.suggestions ?? [];
  const waiting = suggestions.length;

  return (
    <ConnectorsCtx.Provider value={connectors}>
      <SurfaceFrame
        kind={typeMeta(model.type).surfaceKind}
        kicker={
          <span className="chn-pk">
            <span>
              {typeGlyph(model.type)} {typeLabel(model.type)}
            </span>
            {owner && (
              <span className="chn-pk-who">
                <IdentityMark initials={owner.initials} kind={owner.kind} size={16} />
                {owner.kind === "user" ? "Yours" : owner.name}
                {presenter ? ` · presented by ${presenter.name}` : ""}
              </span>
            )}
          </span>
        }
        title={model.title}
        status={<span className="chn-mono">Esc closes</span>}
      >
        <div className="chn-ps">
          {tab === "overview" ? (
            <div className="eac-c eac-c-pv">
              <PieceHeader model={model} connectors={connectors} />
              <PieceHistory model={model} />
            </div>
          ) : (
            <header className="chn-ps-mast">
              <Thumb cover={model.media.cover} type={model.type} size={84} />
              <div>
                <p className="chn-ps-meta">{model.meta}</p>
                <Actions model={model} connectors={connectors} />
              </div>
            </header>
          )}

          <div className="chn-tabs" role="group" aria-label="Piece view">
            <button type="button" aria-pressed={tab === "overview"} onClick={() => setTab("overview")}>
              Overview
            </button>
            <button type="button" aria-pressed={tab === "plan"} onClick={() => setTab("plan")}>
              Plan {waiting > 0 && <span className="chn-count">{waiting} waiting</span>}
            </button>
          </div>

          {tab === "overview" ? (
            <div className="eac-c-pvo">
              <h3 className="chn-kicker">Coverage by identity</h3>
              {coverage && <CoveragePanel data={coverage} identities={model.identities} timeZone={model.timeZone} />}
              {suggestions.length > 0 && (
                <>
                  <h3 className="chn-kicker">Next for this piece</h3>
                  <div className="chn-chips is-stack">
                    {suggestions.slice(0, 4).map((s) => (
                      <NextChip key={s.id} suggestion={s} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : planData ? (
            <PlanPanel data={planData} boardHref={model.links.board} timeZone={model.timeZone} />
          ) : null}
          {planData && !planData.ready && tab === "plan" && <p className="chn-help">Plans are saved once migration 252 is applied.</p>}
        </div>
      </SurfaceFrame>
    </ConnectorsCtx.Provider>
  );
}
