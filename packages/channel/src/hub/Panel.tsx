"use client";

import * as React from "react";
import type { ActionResult } from "@elkdonis/actions";
import { PieceSummary } from "@elkdonis/content/summary";
import { PieceList } from "@elkdonis/content/ui";
import { ChannelDoor, PlanActions, RunButton, StepCheck, SuggestionActs } from "../site/runs";
import { ChannelGrid } from "../site/grid";
import type { ChannelHubData, ChannelHubPiece } from "./data";

/**
 * The Channel hub card's pop-up body (2026-11-15). Header (Channel, the org, Board | Week), the chart on the
 * left (the site Channel's ChannelGrid inside ChannelDoor, so a square opens the same quick form as /channel), a
 * scrolling list of pieces on the right (the shared PieceList). A piece, from the list or the chart, opens its
 * PieceSummary ("sheet") in place of the list, with "← All pieces". Every write goes through `run`, the site's
 * Channel door (plans only; nothing here sends). No next/*.
 */
export interface ChannelHubPanelProps {
  data: ChannelHubData;
  run: (id: string, input: unknown) => Promise<ActionResult>;
  /** The site's Channel page. */
  channelHref?: string;
  /** Open with this piece showing (the harness, and a deep link). */
  initialPiece?: string | null;
  initialMode?: "board" | "week";
}

export function ChannelHubPanel({ data, run, channelHref = "/channel", initialPiece = null, initialMode = "board" }: ChannelHubPanelProps) {
  const [mode, setMode] = React.useState<"board" | "week">(initialMode);
  const [open, setOpen] = React.useState<string | null>(initialPiece);
  const piece = open ? data.pieces.find((p) => p.key === open) ?? null : null;
  const g = mode === "board" ? data.board : data.week;

  // A piece's name in the chart is a "#piece=<key>" link: open it here instead of navigating.
  const onClickCapture = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest?.("a[href^='#piece=']") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    setOpen(decodeURIComponent(a.getAttribute("href")!.slice("#piece=".length)));
  };

  // The chart's quick form is a <dialog> inside the surface's <dialog>. React bubbles a dialog's close and cancel
  // up its tree, so without this the surface's own close handler fires when the form closes and takes the surface down.
  const keepInside = { onClose: (e: React.SyntheticEvent) => e.stopPropagation(), onCancel: (e: React.SyntheticEvent) => e.stopPropagation() } as object;
  return (
    <ChannelDoor run={run}>
      <div className="chp chp-panel" onClickCapture={onClickCapture} {...keepInside}>
        <header className="chp-head">
          <p className="chp-org">{data.orgName}</p>
          <div className="chp-seg" role="group" aria-label="Chart">
            {(["board", "week"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === "board" ? "Board" : "Week"}
              </button>
            ))}
          </div>
        </header>
        <div className="chp-cols">
          <section className="chp-chart kch" aria-label={mode === "board" ? "Pieces by outlet" : "The week"}>
            {data.pieces.length === 0 ? (
              <p className="chp-fine">No pieces yet.</p>
            ) : (
              <ChannelGrid
                key={mode}
                density="compact"
                cols={g.cols}
                rows={g.rows}
                timeZone={data.timeZone}
                caption={mode === "board" ? "Pieces by outlet" : "The week by content kind"}
                pill={mode === "board" ? "date" : "piece"}
                routineNames={mode === "week" ? data.week.routineNames : []}
                routinesHref={`${channelHref}?tab=queue`}
                pieces={data.pieceRefs}
              />
            )}
          </section>
          <aside className="chp-side kch" aria-label="Pieces">
            {piece ? (
              <PieceView piece={piece} timeZone={data.timeZone} back={() => setOpen(null)} />
            ) : (
              <>
                <p className="chp-eb">
                  Pieces <span className="chp-fine">· {data.counts.pieces}</span>
                </p>
                <div className="eac-c chp-list">
                  <PieceList items={data.pieces.map((p) => p.item)} timeZone={data.timeZone} onOpen={(it) => setOpen(it.key)} />
                </div>
              </>
            )}
          </aside>
        </div>
        <footer className="chp-foot">
          <a className="chp-link" href={channelHref}>
            Open the Channel page ↗
          </a>
        </footer>
      </div>
    </ChannelDoor>
  );
}

function PieceView({ piece, timeZone, back }: { piece: ChannelHubPiece; timeZone: string; back: () => void }) {
  const suggestionOf = (m: ChannelHubPiece["moves"][number]) =>
    m.run?.id === "channel-suggestion-accept" ? piece.suggestions.find((s) => s.outlet === m.run!.input.outlet && s.text === m.run!.input.text) ?? null : null;
  const nextRows = piece.moves.map((m) => {
    const s = suggestionOf(m);
    return {
      id: m.id,
      title: m.title,
      reason: [m.kicker, m.reason].filter(Boolean).join(" · ") || null,
      actions: s ? (
        <SuggestionActs s={s} timeZone={timeZone} />
      ) : m.run ? (
        <RunButton id={m.run.id} input={m.run.input} label={m.run.label} busyLabel={m.run.busyLabel} done="Done." />
      ) : (
        <a className="kch-btn kch-btn--ghost kch-btn--sm" href={piece.channelHref}>
          Open in Channel ↗
        </a>
      ),
    };
  });
  const plan = {
    state: (piece.plan.started ? "started" : "none") as "started" | "none",
    goal: piece.plan.goal,
    steps: piece.plan.steps.map((st) => ({
      id: `step-${st.index}`,
      label: st.text,
      done: st.done,
      due: st.on ? `${st.on}T12:00:00Z` : null,
      control: <StepCheck pieceKey={piece.key} identityId={piece.identityId} index={st.index} text={st.text} done={st.done} />,
    })),
    actions: <PlanActions pieceKey={piece.key} identityId={piece.identityId} started={piece.plan.started} />,
  };
  return (
    <div className="chp-piece">
      <div className="chp-piece-bar">
        <button type="button" className="chp-link" onClick={back}>
          ← All pieces
        </button>
        <a className="chp-link" href={piece.channelHref}>
          Open in Channel ↗
        </a>
      </div>
      <PieceSummary
        view={piece.view}
        layout="sheet"
        timeZone={timeZone}
        editHref={piece.editHref}
        studioHref={piece.studioHref}
        makeInto={piece.makeInto}
        nextRows={nextRows}
        plan={plan}
      />
    </div>
  );
}
