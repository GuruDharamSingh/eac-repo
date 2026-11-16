import { mediaThumbnail } from "@elkdonis/utils/media-thumbnail";
import Link from "next/link";
import { PieceRow } from "@elkdonis/content/ui";
import { MATRIX_COLUMNS, MATRIX_LABELS, PIECE_KINDS, kindLabel, type ChannelModel, type ItemState, type Piece, type PieceKind } from "../model";
import { ChannelGrid } from "./grid";
import { boardGrid, weekGrid, routineRows, type RowLinks } from "./grid-data";
import { RunButton, type SiteMove } from "./runs";
import { pieceToListItem } from "./summary-view";
import { outRows, type SiteLinks } from "./view";
import { fmtDay } from "../model";
import { outletLabel } from "../labels";

/**
 * One Channel page (developer, 2026-11-15: "yes"; docs/open/channel-convergence-2026-11-15 C and E):
 * the Home view holds the next row (what to do next, what did not go, the week), the pieces (covers,
 * or the content library's rows), the Board (outlets, or the week with the routines strip) and Out.
 * One count, one list, one chip behaviour (CHANNEL_REGISTRY_AND_BOARD): the kind chips filter the
 * pieces, the Board and the next row together, and every count is read from the same model. A piece
 * opens the manage-piece pop-up. The Board, Queue, Out and Library views stay behind it for now.
 */

export type PiecesMode = "covers" | "list";
export type HomeBoardMode = "outlets" | "week";

const MARK_WORD: Record<ItemState, string> = { published: "out", scheduled: "scheduled", live: "live", draft: "draft", failed: "did not go", empty: "nothing yet" };

/** A piece's outlets as small marks (the library's coverage): filled = out, ring = scheduled, dashed = draft. */
export function OutletDots({ piece }: { piece: Piece }) {
  return (
    <span className="kch-dots" role="img" aria-label={MATRIX_COLUMNS.map((c) => `${MATRIX_LABELS[c]}: ${MARK_WORD[piece.row[c].state]}`).join(", ")}>
      {MATRIX_COLUMNS.map((c) => (
        <span key={c} className="kch-dot-mark" data-state={piece.row[c].state} title={`${MATRIX_LABELS[c]}: ${MARK_WORD[piece.row[c].state]}`} />
      ))}
    </span>
  );
}

export interface ChannelHomeProps {
  model: ChannelModel;
  links: SiteLinks;
  /** The next row for the whole channel (channelNextMoves), already resolved for this site. */
  moves: SiteMove[] | null;
  /** Each move's piece, for the kind filter (move id → piece key). */
  movePieces: Record<string, string | null>;
  kind: PieceKind | null;
  piecesMode: PiecesMode;
  boardMode: HomeBoardMode;
  rowLinks: RowLinks;
  routinesHref: string | null;
  orgQ: string;
}

export function ChannelHome({ model, links, moves, movePieces, kind, piecesMode, boardMode, rowLinks, routinesHref, orgQ }: ChannelHomeProps) {
  const pieces = kind ? model.pieces.filter((p) => p.kind === kind) : model.pieces;
  const inKind = new Set(pieces.map((p) => p.key));
  const kinds = PIECE_KINDS.map((k) => k.id).filter((k) => model.pieces.some((p) => p.kind === k));
  const state = { kind, pieces: piecesMode === "list" ? "list" : null, board: boardMode === "week" ? "week" : null };
  const shownMoves = moves && kind ? moves.filter((m) => !movePieces[m.id] || inKind.has(movePieces[m.id]!)) : moves;
  const failed = outRows(model).filter((r) => r.entry.state === "failed" && inKind.has(r.piece.key)).length;
  const week = weekGrid(model, pieces, rowLinks);
  const dayCount = (date: string) => Object.values(week.rows.find((r) => r.id === date)?.cells ?? {}).reduce((n, c) => n + c.length, 0);
  const board = boardMode === "week" ? week : boardGrid(model, pieces, rowLinks);
  const everyPiece = model.pieces.map((p) => ({ key: p.key, title: p.title || "Untitled", identityId: p.ownerIdentityId }));

  return (
    <div className="kch-home">
      <div className="kch-toolbar">
        <div className="kch-filters" role="group" aria-label="Kind">
          <Link className="kch-chip" href={links.tab("home", { ...state, kind: null })} aria-current={kind ? undefined : "true"}>
            All {model.pieces.length}
          </Link>
          {kinds.map((k) => (
            <Link key={k} className="kch-chip" href={links.tab("home", { ...state, kind: k })} aria-current={kind === k ? "true" : undefined}>
              {kindLabel(k)} {model.pieces.filter((p) => p.kind === k).length}
            </Link>
          ))}
        </div>
      </div>

      <section className="kch-strip" aria-labelledby="kch-strip-h">
        <div className="kch-strip-head">
          <h2 className="kch-eb" id="kch-strip-h">
            Next
          </h2>
          {failed > 0 ? (
            <a className="kch-chip kch-chip--alert" href="#kch-out">
              Did not go · {failed}
            </a>
          ) : null}
          <nav className="kch-days" aria-label="This week">
            {model.week.days.map((d) => {
              const n = dayCount(d.date);
              return (
                <Link key={d.date} className="kch-day-chip" href={links.tab("home", { ...state, board: "week" })} aria-current={d.isToday ? "date" : undefined} title={`${n} ${n === 1 ? "item" : "items"}`}>
                  <span>{new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d.date}T12:00:00Z`))}</span>
                  <b>{n || "·"}</b>
                </Link>
              );
            })}
          </nav>
        </div>
        {shownMoves === null ? (
          <p className="kch-fine">The next moves could not be read just now.</p>
        ) : shownMoves.length === 0 ? (
          <p className="kch-fine">Nothing waiting.</p>
        ) : (
          <div className="kch-strip-moves">
            <ul className="kch-nextcards">
              {shownMoves.map((m) => {
                const key = movePieces[m.id];
                const piece = key ? model.pieces.find((p) => p.key === key) ?? null : null;
                return (
                  <li key={m.id} className="kch-nextcard">
                    <span className="kch-eb">{m.kicker}</span>
                    {piece ? (
                      <Link className="kch-nextcard-title" href={links.tab("home", { ...state, piece: piece.key, tab: "overview" })} scroll={false}>
                        {m.title}
                      </Link>
                    ) : (
                      <span className="kch-nextcard-title">{m.title}</span>
                    )}
                    {m.reason ? <span className="kch-fine kch-nextcard-why">{m.reason}</span> : null}
                    {m.run ? (
                      <span className="kch-nextcard-acts">
                        <RunButton id={m.run.id} input={m.run.input} label={m.run.label} busyLabel={m.run.busyLabel} done="Done." />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <div className="kch-home-main">
        <section className="kch-home-pieces" aria-labelledby="kch-pieces-h">
          <div className="kch-sec-bar">
            <h2 className="kch-eb" id="kch-pieces-h">
              Pieces
            </h2>
            <div className="kch-seg" role="group" aria-label="Show pieces as">
              <Link href={links.tab("home", { ...state, pieces: null })} aria-current={piecesMode === "covers" ? "true" : undefined}>
                Covers
              </Link>
              <Link href={links.tab("home", { ...state, pieces: "list" })} aria-current={piecesMode === "list" ? "true" : undefined}>
                List
              </Link>
            </div>
          </div>
          {pieces.length === 0 ? (
            <p className="kch-fine">No pieces yet.</p>
          ) : piecesMode === "covers" ? (
            <ul className="kch-cards">
              {pieces.map((p) => (
                <li key={p.key}>
                  <Link className="kch-card-link" href={rowLinks.manageHref(p)} scroll={false}>
                    {p.imageUrl ? <img className="kch-card-cover" src={mediaThumbnail(p.imageUrl, 512)} alt="" loading="lazy" /> : <span className="kch-card-band" data-type={p.kind} aria-hidden="true" />}
                    <span className="kch-card-body">
                      <span className="kch-eb">{kindLabel(p.kind)}</span>
                      <span className="kch-card-title">{p.title || "Untitled"}</span>
                      <span className="kch-fine">{p.status}</span>
                      <OutletDots piece={p} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            // The content library's own rows (@elkdonis/content/ui), as the hub card lists them.
            <ul className="kch-ec eac-c-rows">
              {pieces.map((p) => (
                <PieceRow key={p.key} item={pieceToListItem(p, model.timeZone)} timeZone={model.timeZone} href={rowLinks.manageHref(p)} />
              ))}
            </ul>
          )}
        </section>

        <section className="kch-home-board" aria-labelledby="kch-board-h">
          <div className="kch-sec-bar">
            <h2 className="kch-eb" id="kch-board-h">
              Board
            </h2>
            <div className="kch-seg" role="group" aria-label="Board by">
              <Link href={links.tab("home", { ...state, board: null })} aria-current={boardMode === "outlets" ? "true" : undefined}>
                Outlets
              </Link>
              <Link href={links.tab("home", { ...state, board: "week" })} aria-current={boardMode === "week" ? "true" : undefined}>
                Week
              </Link>
            </div>
            <Link className="kch-fine" href={links.tab(boardMode === "week" ? "queue" : "board", { kind })}>
              Full {boardMode === "week" ? "Queue" : "Board"} ›
            </Link>
          </div>
          {pieces.length === 0 ? (
            <p className="kch-fine">No pieces yet.</p>
          ) : (
            <ChannelGrid
              cols={board.cols}
              rows={board.rows}
              routineNames={boardMode === "week" ? routineRows(model).map((r) => r.name) : []}
              routinesHref={boardMode === "week" ? routinesHref : null}
              timeZone={model.timeZone}
              caption={boardMode === "week" ? "The week by content kind" : "Pieces by outlet"}
              pill={boardMode === "week" ? "piece" : "date"}
              density="compact"
              pieces={everyPiece}
            />
          )}
        </section>
      </div>

      <section className="kch-home-out" id="kch-out" aria-labelledby="kch-out-h">
        <div className="kch-sec-bar">
          <h2 className="kch-eb" id="kch-out-h">
            Out · last 30 days
          </h2>
        </div>
        {(() => {
          const rows = outRows(model).filter((r) => inKind.has(r.piece.key));
          const bad = rows.filter((r) => r.entry.state === "failed");
          const recent = rows.filter((r) => r.entry.state !== "failed").slice(0, 5);
          if (rows.length === 0) return <p className="kch-fine">Nothing went out in the last 30 days.</p>;
          return (
            <ul className="kch-outlist">
              {[...bad, ...recent].map(({ id, piece, entry }) => (
                <li key={id} data-failed={entry.state === "failed" ? "1" : undefined}>
                  <Link className="kch-outlist-piece" href={rowLinks.manageHref(piece)} scroll={false}>
                    {piece.title || "Untitled"}
                  </Link>
                  <span className="kch-fine">{outletLabel(entry.outlet)}</span>
                  <span className="kch-fine">{entry.at ? fmtDay(entry.at, model.timeZone) : ""}</span>
                  {entry.state === "failed" ? (
                    <a className="kch-btn kch-btn--ghost kch-btn--sm" href={links.network(`/channel/piece/${piece.subject.kind}/${encodeURIComponent(piece.subject.id)}?org=${orgQ}`)}>
                      Retry ↗
                    </a>
                  ) : entry.href ? (
                    <a className="kch-fine" href={entry.href}>
                      View ↗
                    </a>
                  ) : (
                    <span className="kch-mark" data-state="out">
                      out
                    </span>
                  )}
                </li>
              ))}
            </ul>
          );
        })()}
        <p className="kch-fine">
          <Link href={links.tab("out")}>All of Out ›</Link>
        </p>
      </section>
    </div>
  );
}
