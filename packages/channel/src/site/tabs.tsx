import { mediaThumbnail } from "@elkdonis/utils/media-thumbnail";
import Link from "next/link";
import type { ReactNode } from "react";
import { parsePlan } from "@elkdonis/services/channel-plan-md";
import { MATRIX_COLUMNS, MATRIX_LABELS, fmtDay, fmtLong, fmtTime, kindLabel, queueByPiece, type ChannelModel, type Piece, type PieceKind } from "../model";
import { outletLabel } from "../labels";
import { PieceSummary as SharedSummary, makeIntoFor } from "@elkdonis/content/summary";
import { buildPieceSummaryView } from "./summary-view";
import { MAKE_INTO, OUT_OUTLETS, kindCounts, outRows, studioKindOf, wentWhere, type MarkState, type SiteLinks } from "./view";
import { boardGrid, dayHeading, pieceGrid, routineRows, weekGrid, type RowLinks } from "./grid-data";
import { ChannelGrid } from "./grid";
import { PieceSteps, PlanActions, RunButton, StepCheck, SuggestionActs, type SiteMove } from "./runs";

/**
 * A site's Channel tabs (2026-11-14; design canvas "Studio pipeline frame", D, D2, E), in the
 * site's look: Board and Queue as one table (2026-11-15, see below), the manage-piece pop-up,
 * and Out. Server components over the shared Channel model; the moves are runs.tsx and grid.tsx
 * (client) through the site's Channel door.
 */

const idOf = (p: Piece) => p.subject.id;
const anchorOf = (p: Piece) => `piece-${p.key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
const isArtwork = (p: Piece) => p.kind === "artwork" || p.kind === "product";

export function Thumb({ piece, size = 52 }: { piece: Piece; size?: number }) {
  return piece.imageUrl ? (
    <img className="kch-thumb" src={mediaThumbnail(piece.imageUrl, 128)} alt="" loading="lazy" style={{ width: size, height: size }} />
  ) : (
    <span className="kch-thumb" aria-hidden="true" style={{ width: size, height: size }} />
  );
}

function pieceLine(p: Piece, tz: string): string {
  return [kindLabel(p.kind), p.eventAt ? fmtLong(p.eventAt, tz) : p.meta !== kindLabel(p.kind) ? p.meta : null, p.status].filter(Boolean).join(" · ");
}

export function MakeIntoMenu({ piece, links }: { piece: Piece; links: SiteLinks }) {
  const targets = MAKE_INTO[piece.kind];
  if (!targets?.length) return null;
  return (
    <details className="kch-menu">
      <summary className="kch-btn kch-btn--ghost kch-btn--sm">Make into ▾</summary>
      <div className="kch-menu-list">
        {targets.map((t) => (
          <a key={t.to} href={links.makeInto(piece.key, t.to)}>
            {t.label} ↗
          </a>
        ))}
        <p className="kch-fine">A new draft in Studio, linked to this piece.</p>
      </div>
    </details>
  );
}

function StudioLink({ piece, links }: { piece: Piece; links: SiteLinks }) {
  const kind = studioKindOf(piece.kind);
  return (
    <a className="kch-btn kch-btn--plain kch-btn--sm" href={links.studio(kind ? { kind, id: idOf(piece) } : {})}>
      Open in Studio ↗
    </a>
  );
}

function KindChips({ tab, kinds, kind, all, links }: { tab: string; kinds: Array<{ kind: PieceKind; n: number }>; kind: PieceKind | null; all: number; links: SiteLinks }) {
  return (
    <div className="kch-filters">
      <Link className="kch-chip" href={links.tab(tab)} aria-current={kind ? undefined : "true"}>
        All {all}
      </Link>
      {kinds.map((k) => (
        <Link key={k.kind} className="kch-chip" href={links.tab(tab, { kind: k.kind })} aria-current={kind === k.kind ? "true" : undefined}>
          {kindLabel(k.kind)} {k.n}
        </Link>
      ))}
    </div>
  );
}

// ── Board and Queue: one table (developer, 2026-11-15) ───────────────────────
// Board: pieces × outlets. Queue by week: pieces × days, the routines' rows above. Queue by piece:
// one piece's outlet types × days, its routine slots and its plan steps. A square opens its quick
// form (grid.tsx); a piece's name opens the manage-piece pop-up (`?piece=`), which alone carries
// Edit, Make into and Open in Studio.

export type QueueView = "week" | "piece";


function QueueOptions({ view, links, model, focus }: { view: QueueView; links: SiteLinks; model: ChannelModel; focus: string | null }) {
  return (
    <div className="kch-planbar">
      <div className="kch-seg" role="group" aria-label="Queue by">
        <Link href={links.tab("queue", { by: "week", week: model.week.from })} aria-current={view === "week" ? "true" : undefined}>
          By week
        </Link>
        <Link href={links.tab("queue", { by: "piece", focus, week: model.week.from })} aria-current={view === "piece" ? "true" : undefined}>
          By piece
        </Link>
      </div>
      <nav className="kch-range" aria-label="Weeks">
        <Link href={links.tab("queue", { by: view, focus, week: model.week.prev })} aria-label="Earlier week">
          ‹
        </Link>
        <span>{model.week.label}</span>
        <Link href={links.tab("queue", { by: view, focus, week: model.week.next })} aria-label="Later week">
          ›
        </Link>
      </nav>
    </div>
  );
}

const pieceList = (model: ChannelModel) => model.pieces.map((p) => ({ key: p.key, title: p.title || "Untitled", identityId: p.ownerIdentityId }));

export function QueueTab({
  model,
  links,
  kind,
  view = "week",
  focus = null,
  rowLinks,
  routinesHref,
}: {
  model: ChannelModel;
  links: SiteLinks;
  kind: PieceKind | null;
  view?: QueueView;
  focus?: string | null;
  rowLinks: RowLinks;
  routinesHref: string | null;
}) {
  const routines = routineRows(model);
  if (view === "piece") return <QueueByPiece model={model} links={links} focus={focus} rowLinks={rowLinks} routines={routines} routinesHref={routinesHref} />;
  const pieces = kind ? model.pieces.filter((p) => p.kind === kind) : model.pieces;
  const g = weekGrid(model, pieces, rowLinks);
  return (
    <div className="kch-stack kch-stack--tight">
      <div className="kch-toolbar">
        <QueueOptions view="week" links={links} model={model} focus={focus} />
        <KindChips tab="queue" kinds={kindCounts(model.pieces)} kind={kind} all={model.pieces.length} links={links} />
      </div>
      <ChannelGrid
        cols={g.cols}
        rows={g.rows}
        routineNames={routines.map((r) => r.name)}
        routinesHref={routinesHref}
        timeZone={model.timeZone}
        caption="The week by content kind"
        pill="piece"
        pieces={pieceList(model)}
      />
    </div>
  );
}

function QueueByPiece({
  model,
  links,
  focus,
  rowLinks,
  routines,
  routinesHref,
}: {
  model: ChannelModel;
  links: SiteLinks;
  focus: string | null;
  rowLinks: RowLinks;
  routines: ReturnType<typeof routineRows>;
  routinesHref: string | null;
}) {
  const waiting = queueByPiece(model.pieces).map((r) => r.piece);
  const p = model.pieces.find((x) => x.key === focus) ?? waiting[0] ?? model.pieces[0] ?? null;
  const tz = model.timeZone;
  if (!p) return <p className="kch-fine">No pieces yet.</p>;
  const g = pieceGrid(model, p, rowLinks);
  const steps = p.plan ? parsePlan(p.plan.bodyMd).steps.map((s) => ({ index: s.index, text: s.text, done: s.done, on: s.on })) : [];
  const slots = routines.flatMap((r) =>
    Object.entries(r.cells).flatMap(([day, items]) => items.filter((i) => i.state === "slot" && i.at).map((i) => ({ r, i, day }))),
  );
  return (
    <div className="kch-stack kch-stack--tight">
      <div className="kch-toolbar">
        <QueueOptions view="piece" links={links} model={model} focus={p.key} />
      </div>
      <form className="kch-picker" method="get" action="/channel">
        <input type="hidden" name="view" value="queue" />
        <input type="hidden" name="by" value="piece" />
        <input type="hidden" name="week" value={model.week.from} />
        <label>
          <span className="kch-fine">Piece</span>
          <select name="focus" defaultValue={p.key}>
            {model.pieces.map((x) => (
              <option key={x.key} value={x.key}>
                {x.title || "Untitled"} · {kindLabel(x.kind)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="kch-btn kch-btn--ghost kch-btn--sm">
          Show
        </button>
      </form>

      <section className="kch-card kch-focus-head" aria-label={p.title || "Piece"}>
        <Thumb piece={p} size={56} />
        <div className="kch-qtitle">
          <h2 className="kch-h3">{p.title || "Untitled"}</h2>
          <p className="kch-fine">{pieceLine(p, tz)}</p>
        </div>
        <Link className="kch-btn kch-btn--ghost kch-btn--sm" href={rowLinks.manageHref(p)} scroll={false}>
          Manage the piece
        </Link>
      </section>

      <ChannelGrid cols={g.cols} rows={g.rows} timeZone={tz} caption={`${p.title}: outlets by day`} pill="time" pieces={pieceList(model)} />

      <div className="kch-focus-panels">
        <section className="kch-card" aria-labelledby="kch-focus-routines">
          <h2 className="kch-h3" id="kch-focus-routines">
            Routines
          </h2>
          {slots.length === 0 ? (
            <p className="kch-fine">No open routine slots this week.</p>
          ) : (
            <ul className="kch-slot-list">
              {slots.map(({ r, i, day }) => (
                <li key={i.id}>
                  <span>
                    <b>{r.name}</b>
                    <span className="kch-fine">
                      {" "}
                      · {outletLabel(r.outlet)} · {dayHeading(day)} {fmtTime(i.at, tz)}
                    </span>
                  </span>
                  <RunButton
                    id="channel-slot-fill"
                    input={{ routineId: r.id, at: i.at, pieceKey: p.key }}
                    label="Put it here"
                    busyLabel="Filling…"
                    done="The slot holds a draft of this piece."
                    ghost
                  />
                </li>
              ))}
            </ul>
          )}
          {routinesHref ? (
            <p className="kch-fine">
              <a href={routinesHref}>Set up routines ↗</a>
            </p>
          ) : null}
        </section>
        <section className="kch-card" aria-labelledby="kch-focus-steps">
          <h2 className="kch-h3" id="kch-focus-steps">
            Steps
          </h2>
          <PieceSteps pieceKey={p.key} identityId={p.ownerIdentityId} steps={steps} />
        </section>
      </div>
    </div>
  );
}

export function BoardTab({ model, links, kind, rowLinks }: { model: ChannelModel; links: SiteLinks; kind: PieceKind | null; rowLinks: RowLinks }) {
  const pieces = kind ? model.pieces.filter((p) => p.kind === kind) : model.pieces;
  const g = boardGrid(model, pieces, rowLinks);
  return (
    <div className="kch-stack kch-stack--tight">
      <div className="kch-toolbar">
        <KindChips tab="board" kinds={kindCounts(model.pieces)} kind={kind} all={model.pieces.length} links={links} />
      </div>
      {pieces.length === 0 ? (
        <p className="kch-fine">No pieces yet.</p>
      ) : (
        <ChannelGrid cols={g.cols} rows={g.rows} timeZone={model.timeZone} caption="Pieces by outlet" pill="date" pieces={pieceList(model)} />
      )}
    </div>
  );
}

/**
 * The manage-piece pop-up (developer, 2026-11-15): the shared `@elkdonis/content/summary`
 * PieceSummary in its "popup" layout (a panel from the right, a bottom sheet on a phone), fed from
 * the Channel model. It alone carries Edit, Make into and Open in Studio. Planning happens inside
 * it (the piece's suggestions with Accept / Plan it / ✕), so it never sends the reader to the
 * Queue and back. Edit opens the site's own quick form in place (`edit`); that form's "More
 * options in Studio" is the full form. Kinds without a quick form edit in Studio.
 */
export function PieceSummary({
  piece: p,
  model,
  links,
  closeHref,
  editHref,
  editing = false,
  edit = null,
  closeEditHref,
  moves = [],
  planHref = null,
  planOpen = false,
}: {
  piece: Piece;
  model: ChannelModel;
  links: SiteLinks;
  closeHref: string;
  /** "Next for this piece": channelNextMoves(model, { pieceKey }), the list the Dock and Studio's summary read. */
  moves?: SiteMove[];
  /** The piece's plan view (`?piece=…&tab=plan`), the shared "Plan it". */
  planHref?: string | null;
  /** Opened as the plan view (Studio's "Plan it"): the plan's controls lead. */
  planOpen?: boolean;
  /** The site's quick form (`?edit=1`) when it has one for this kind; else Studio. */
  editHref: string;
  editing?: boolean;
  edit?: ReactNode;
  closeEditHref: string;
}) {
  const tz = model.timeZone;
  const kind = studioKindOf(p.kind);
  const view = buildPieceSummaryView(p, model, { planHref });
  // A move that is a suggestion keeps its own moves (Accept, Plan it with a date, ✕); the rest run here or open.
  const suggestionOf = (m: SiteMove) =>
    m.run?.id === "channel-suggestion-accept" ? p.suggestions.find((s) => s.outlet === m.run!.input.outlet && s.text === m.run!.input.text) ?? null : null;
  const nextRows = moves.map((m) => {
    const s = suggestionOf(m);
    return {
      id: m.id,
      title: m.title,
      reason: [m.kicker, m.reason].filter(Boolean).join(" · ") || null,
      actions: s ? (
        <SuggestionActs s={s} timeZone={tz} />
      ) : m.run ? (
        <RunButton id={m.run.id} input={m.run.input} label={m.run.label} busyLabel={m.run.busyLabel} done="Done." />
      ) : m.openHref ? (
        <a className="kch-btn kch-btn--ghost kch-btn--sm" href={m.openHref}>
          {m.openLabel} ↗
        </a>
      ) : null,
    };
  });
  // The Plan box (fc's `plan` prop): plan.md's steps, each ticked through the door; add a step; propose steps.
  const parsed = p.plan ? parsePlan(p.plan.bodyMd) : null;
  const plan = {
    state: (p.plan ? "started" : "none") as "started" | "none",
    goal: parsed?.goal?.trim() || null,
    steps: (parsed?.steps ?? []).map((st) => ({
      id: `step-${st.index}`,
      label: st.text,
      done: st.done,
      // plan.md dates are plain days; anchor them at noon UTC so no zone moves them to the day before.
      due: st.on ? `${st.on}T12:00:00Z` : null,
      control: <StepCheck pieceKey={p.key} identityId={p.ownerIdentityId} index={st.index} text={st.text} done={st.done} />,
    })),
    actions: <PlanActions pieceKey={p.key} identityId={p.ownerIdentityId} started={Boolean(p.plan)} />,
  };
  return (
    <SharedSummary
      view={view}
      layout="popup"
      timeZone={tz}
      closeHref={closeHref}
      editHref={editHref}
      editing={editing}
      edit={edit}
      closeEditHref={closeEditHref}
      studioHref={links.studio(kind ? { kind, id: idOf(p) } : {})}
      makeInto={makeIntoFor(p.kind).map((t) => ({ to: t.to, label: t.label, href: links.makeInto(p.key, t.to) }))}
      nextRows={nextRows}
      plan={plan}
    />
  );
}


// ── Out (E) ───────────────────────────────────────────────────────────────────

export function OutTab({ model, links, outlet, failedOnly, orgQ }: { model: ChannelModel; links: SiteLinks; outlet: string | null; failedOnly: boolean; orgQ: string }) {
  const tz = model.timeZone;
  const rows = outRows(model);
  const failed = rows.filter((r) => r.entry.state === "failed").length;
  const group = OUT_OUTLETS.find((o) => o.id === outlet) ?? null;
  const shown = rows.filter((r) => (!group || group.outlets.includes(r.entry.outlet)) && (!failedOnly || r.entry.state === "failed"));
  const params = (extra: Record<string, string | null>) => ({ outlet: group?.id ?? null, failed: failedOnly ? "1" : null, ...extra });
  const connected = (id: "instagram" | "facebook") => model.outlets.find((o) => o.id === id)?.connected ?? false;

  return (
    <div className="kch-out">
      <nav className="kch-out-side" aria-label="Outlets">
        <p className="kch-eb">Outlets</p>
        <Link className="kch-out-o" href={links.tab("out", params({ outlet: null }))} aria-current={group ? undefined : "true"}>
          <span>All outlets</span>
          <span className="kch-fine">{rows.length}</span>
        </Link>
        {OUT_OUTLETS.map((o) => {
          const n = rows.filter((r) => o.outlets.includes(r.entry.outlet)).length;
          if (o.connect && !connected(o.connect) && n === 0)
            return (
              <span key={o.id} className="kch-out-o">
                <span>{o.label}</span>
                <a href={links.network(`/channel/outlets?org=${orgQ}&tab=${o.connect}`)}>Connect ↗</a>
              </span>
            );
          return (
            <Link key={o.id} className="kch-out-o" href={links.tab("out", params({ outlet: o.id }))} aria-current={group?.id === o.id ? "true" : undefined}>
              <span>{o.label}</span>
              <span className="kch-fine">{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="kch-stack">
        <div className="kch-out-head">
          <div className="kch-seg" role="group" aria-label="Show">
            <Link href={links.tab("out", params({ failed: null }))} aria-current={failedOnly ? undefined : "true"}>
              Everything
            </Link>
            <Link href={links.tab("out", params({ failed: "1" }))} aria-current={failedOnly ? "true" : undefined}>
              Did not go · {failed}
            </Link>
          </div>
          <span className="kch-fine">Last 30 days</span>
        </div>
        {shown.length === 0 ? (
          <p className="kch-fine">{failedOnly ? "Nothing failed." : "Nothing went out in the last 30 days."}</p>
        ) : (
          <div className="kch-board-wrap">
            <table className="kch-outt">
              <caption className="kch-sr">What went where</caption>
              <thead>
                <tr>
                  <th scope="col">Piece</th>
                  <th scope="col">Outlet</th>
                  <th scope="col">When</th>
                  <th scope="col">Result</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ id, piece, entry }) => {
                  const bad = entry.state === "failed";
                  return (
                    <tr key={id} data-failed={bad ? "1" : undefined}>
                      <th scope="row">
                        <Link className="kch-board-piece" href={links.tab("board", { piece: piece.key })}>
                          <span className="kch-dot" data-kind={piece.kind} aria-hidden="true" />
                          <span>{piece.title || "Untitled"}</span>
                        </Link>
                      </th>
                      <td>{outletLabel(entry.outlet)}</td>
                      <td>{entry.at ? fmtDay(entry.at, tz) : ""}</td>
                      <td className="kch-fine">{entry.href && !bad ? <a href={entry.href}>{entry.sub || entry.label}</a> : entry.sub || entry.label}</td>
                      <td>
                        {bad ? (
                          <a className="kch-btn kch-btn--ghost kch-btn--sm" href={links.network(`/channel/piece/${piece.subject.kind}/${encodeURIComponent(piece.subject.id)}?org=${orgQ}`)}>
                            Retry ↗
                          </a>
                        ) : (
                          <span className="kch-mark" data-state="out">
                            out
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="kch-fine">Posting to Instagram and Facebook runs on arts-collective.com; Retry opens the piece there.</p>
      </div>
    </div>
  );
}
