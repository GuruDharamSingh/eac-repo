"use client";

import * as React from "react";
import { ArrowLeftRight, CalendarDays, ExternalLink, PenLine } from "lucide-react";
import { SurfaceFrame, useLayer } from "@elkdonis/cms-ui/surface";
import { fmtDayLong, groupTimeline, panelOf, type ContentDetailModel } from "../model";
import { typeGlyph, typeLabel, typeMeta } from "../registry";
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

/**
 * The content detail, pop-up layout (lifted from Channel's PieceSurface, 3a +
 * 3c): a masthead, then Overview (where it has gone, coverage by identity,
 * what is next) or Plan (plan.md beside the board's waiting suggestions).
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
  // Ahead (booked), Now (live or the last day), Past: empty groups are left out.
  const g = groupTimeline(model.timeline, model.now);
  const history = ([
    ["Ahead", g.ahead],
    [`Now · ${fmtDayLong(model.now, model.timeZone)}`, g.now],
    ["Past", g.past],
  ] as const).filter(([, e]) => e.length > 0);

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
          <header className="chn-ps-mast">
            <Thumb cover={model.media.cover} type={model.type} size={84} />
            <div>
              <p className="chn-ps-meta">{model.meta}</p>
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
            </div>
          </header>

          <div className="chn-tabs" role="group" aria-label="Piece view">
            <button type="button" aria-pressed={tab === "overview"} onClick={() => setTab("overview")}>
              Overview
            </button>
            <button type="button" aria-pressed={tab === "plan"} onClick={() => setTab("plan")}>
              Plan {waiting > 0 && <span className="chn-count">{waiting} waiting</span>}
            </button>
          </div>

          {tab === "overview" ? (
            <div className="chn-ps-grid">
              <section>
                {history.length === 0 ? (
                  <>
                    <h3 className="chn-kicker">Where it has gone</h3>
                    <Timeline events={[]} identities={model.identities} timeZone={model.timeZone} showIdentity />
                  </>
                ) : (
                  history.map(([label, events], i) => (
                    <React.Fragment key={label}>
                      <h3 className="chn-kicker" style={i > 0 ? { marginTop: 18 } : undefined}>
                        {label}
                      </h3>
                      <Timeline events={events} identities={model.identities} timeZone={model.timeZone} showIdentity />
                    </React.Fragment>
                  ))
                )}
              </section>
              <aside>
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
              </aside>
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
