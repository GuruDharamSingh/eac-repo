"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, PenLine, Plus, Zap } from "lucide-react";
import { useSurface } from "@elkdonis/cms-ui/surface";
import { MATRIX_COLUMNS, fmtDay, fmtTime, queueByPiece, type DayItem, type DayView, type Outlet, type QueuePiece, type TrayItem } from "@/lib/channel/model";
import { acceptSuggestionsAction, addTodoAction, setTodoDoneAction } from "@/lib/channel/actions";
import { CHANNEL_BASE, suggestionInput, useChannel } from "./context";
import { OutletIcon } from "./icons";
import { KindLine, RoutineLine, RoutinesStrip, StateMark, Thumb } from "./bits";
import { specFromSuggestion, type QuickSpec } from "./quick-spec";
import { outletLabel } from "./labels";

/**
 * Queue (2a): what Channel suggests, one card per piece (developer, 2026-11-12: "queue is
 * suggestive, per artwork"), with the week and month as secondary views. What is confirmed
 * lives on the Board (the coverage matrix and each piece's board).
 */
export function Queue({ view }: { view: "pieces" | "week" | "month"; editRoutines?: boolean }) {
  const { model, href } = useChannel();
  const w = model.week;
  return (
    <div className="chn-page">
      <header className="chn-head">
        <div>
          <h1>Queue</h1>
          <p>
            {view === "pieces"
              ? "What Channel suggests for each piece. Plan it puts a piece's suggestions on the Board as drafts; nothing is sent from here."
              : "What's planned, what your routines ask for, and what's still open. Scheduled items are plans: Channel does not send them yet."}
          </p>
        </div>
        <div className="chn-actions">
          {view !== "pieces" && (
          <nav className="chn-range" aria-label="Dates">
            <Link href={href(`${CHANNEL_BASE}/queue`, { week: w.prev, view })} aria-label="Earlier">
              <ChevronLeft size={16} />
            </Link>
            <span>{w.label}</span>
            <Link href={href(`${CHANNEL_BASE}/queue`, { week: w.next, view })} aria-label="Later">
              <ChevronRight size={16} />
            </Link>
          </nav>
          )}
          <div className="chn-seg" role="group" aria-label="View">
            <Link href={href(`${CHANNEL_BASE}/queue`)} aria-current={view === "pieces" ? "page" : undefined}>
              By piece
            </Link>
            <Link href={href(`${CHANNEL_BASE}/queue`, { view: "week" })} aria-current={view === "week" ? "page" : undefined}>
              Week
            </Link>
            <Link href={href(`${CHANNEL_BASE}/queue`, { view: "month" })} aria-current={view === "month" ? "page" : undefined}>
              Month
            </Link>
            <Link href={href(CHANNEL_BASE, { view: "matrix" })}>Board</Link>
          </div>
          <Link className="chn-btn is-primary" href={href(`${CHANNEL_BASE}/new`)}>
            <PenLine size={15} aria-hidden /> New post
          </Link>
        </div>
      </header>

      <RoutinesStrip routines={model.routines} />

      {view === "pieces" ? (
        <ByPiece />
      ) : view === "month" ? (
        <div className="chn-month">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <span key={d} className="chn-month-h">
              {d}
            </span>
          ))}
          {w.days.map((d) => (
            <div key={d.date} className="chn-month-day" data-today={d.isToday ? "1" : "0"}>
              <span className="chn-day-label">{Number(d.date.slice(8, 10))}</span>
              {d.items.slice(0, 4).map((i) => (
                <MonthItem key={i.id} item={i} />
              ))}
              {d.items.length > 4 && <small>+{d.items.length - 4} more</small>}
            </div>
          ))}
        </div>
      ) : (
        <ol className="chn-week">
          {w.days.map((d) => (
            <Day key={d.date} day={d} />
          ))}
        </ol>
      )}

      <Tray items={view === "pieces" ? model.tray.filter((t) => t.type !== "gap") : model.tray} />
    </div>
  );
}

/** The Queue by piece: each piece with its suggestions, its accepted drafts and Plan it. */
function ByPiece() {
  const { model } = useChannel();
  const rows = React.useMemo(() => queueByPiece(model.pieces), [model.pieces]);
  if (rows.length === 0)
    return <p className="chn-empty-line">Nothing to suggest right now. New pieces and open routine slots bring suggestions here.</p>;
  return (
    <ol className="chn-qpieces">
      {rows.slice(0, 40).map((r) => (
        <QueueCard key={r.piece.key} row={r} />
      ))}
    </ol>
  );
}

function QueueCard({ row }: { row: QueuePiece }) {
  const { model, openPiece, openQuick, openAdjust, scopeOrg } = useChannel();
  const surface = useSurface();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [planned, setPlanned] = React.useState<number | null>(null);
  const p = row.piece;
  const confirmed = MATRIX_COLUMNS.filter((c) => p.row[c].state !== "empty");

  async function planIt() {
    setBusy(true);
    setError(null);
    const r = await acceptSuggestionsAction(row.suggestions.map((s) => suggestionInput(s, scopeOrg)));
    setBusy(false);
    if (r.ok === false) return setError(r.error);
    setPlanned(r.accepted);
    surface.connectors.onMutated?.();
  }

  return (
    <li className="chn-qpiece" id={`piece-${p.key}`}>
      <header className="chn-qpiece-head">
        <button type="button" className="chn-matrix-piece" onClick={(e) => openPiece(p.key, e.currentTarget)}>
          <Thumb piece={p} size={48} />
          <span>
            <strong>{p.title}</strong>
            <KindLine piece={p} />
          </span>
        </button>
        <span className="chn-qpiece-out" aria-label="On the Board">
          {confirmed.map((c) => (
            <span key={c} className="chn-cell" data-state={p.row[c].state} title={`${c}: ${p.row[c].state}`}>
              <OutletIcon outlet={c} size={13} /> <StateMark state={p.row[c].state} size={11} />
            </span>
          ))}
        </span>
      </header>
      {row.suggestions.length > 0 && (
        <ul className="chn-qpiece-list">
          {row.suggestions.map((s) => (
            <li key={s.id} className="chn-sugline">
              <small>
                {s.at ? `${fmtDay(s.at, model.timeZone)} · ` : ""}
                {s.reason}
              </small>
              <span className="chn-qpiece-acts">
                <button type="button" className="chn-next" onClick={(e) => openQuick(specFromSuggestion(s, p, null), e.currentTarget)}>
                  <OutletIcon outlet={s.outlet} size={13} /> {s.text}
                </button>
                <button type="button" className="chn-linkbtn" onClick={(e) => openAdjust(s, e.currentTarget)}>
                  Adjust
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {row.drafts.length > 0 && (
        <p className="chn-qpiece-drafts">
          <StateMark state="draft" size={12} /> {row.drafts.length === 1 ? "1 draft" : `${row.drafts.length} drafts`} on the Board:{" "}
          {row.drafts
            .slice(0, 3)
            .map((d) => `${outletLabel(d.outlet)}${d.at ? ` ${fmtDay(d.at, model.timeZone)}` : ""}`)
            .join(", ")}
        </p>
      )}
      <footer className="chn-qpiece-foot">
        {error ? <small className="is-alert">{error}</small> : planned !== null ? <small>{planned === 1 ? "1 step" : `${planned} steps`} added to the Board.</small> : null}
        {row.suggestions.length > 0 && (
          <button type="button" className="chn-btn is-primary is-small" disabled={busy || !model.ready} onClick={planIt}>
            <ClipboardList size={14} aria-hidden /> Plan it
          </button>
        )}
      </footer>
    </li>
  );
}

function Day({ day }: { day: DayView }) {
  return (
    <li className="chn-day" data-today={day.isToday ? "1" : "0"}>
      <div className="chn-day-head">
        <strong>{day.label}</strong>
        {day.isToday ? <small>today</small> : day.isTomorrow ? <small>tomorrow</small> : null}
      </div>
      <div className="chn-day-items">
        {day.items.map((i) => (
          <Item key={i.id} item={i} />
        ))}
      </div>
      <AddTodo date={day.date} />
    </li>
  );
}

function Item({ item }: { item: DayItem }) {
  const { model, openPiece, openQuick, openAdjust, piece, scopeOrg } = useChannel();
  const surface = useSurface();
  const [busy, setBusy] = React.useState(false);
  switch (item.type) {
    case "event":
      return (
        <button type="button" className="chn-anchor" onClick={() => openPiece(item.pieceKey)}>
          <CalendarDays size={13} aria-hidden /> {item.title}
        </button>
      );
    case "post":
      return (
        <article className="chn-card" data-state={item.state}>
          {item.pieceTitle && <small className="chn-card-piece">{item.pieceTitle}</small>}
          <button type="button" className="chn-card-title" onClick={() => item.pieceKey && openPiece(item.pieceKey)}>
            {item.title}
          </button>
          <span className="chn-card-line">
            {item.outlets.map((o) => (
              <OutletIcon key={o} outlet={o} state={item.state} size={13} />
            ))}
            {fmtTime(item.at, model.timeZone)}
          </span>
          <span className="chn-tag" data-state={item.state}>
            {item.stage}
          </span>
          {item.routineName && <RoutineLine name={`${item.routineName} routine`} />}
        </article>
      );
    case "slot": {
      const fallback = model.pieces.find((p) => p.suggestions.some((s) => s.outlet === item.outlet)) ?? model.pieces[0];
      const spec: QuickSpec | null = item.suggestion
        ? specFromSuggestion(item.suggestion, piece(item.suggestion.pieceKey), item.routineName)
        : fallback
          ? {
              title: `${outletLabel(item.outlet)}: ${fallback.title}`,
              kicker: `Filling · ${item.routineName} slot`,
              pieceKey: fallback.key,
              outlet: item.outlet,
              identityId: fallback.ownerIdentityId,
              at: item.at,
              routineId: item.routineId,
              routineName: item.routineName,
            }
          : null;
      return (
        <div className="chn-slot">
          <span className="chn-slot-head">
            <OutletIcon outlet={item.outlet} size={14} /> {outletLabel(item.outlet)} slot
          </span>
          <small>
            {item.cadence} · {fmtTime(item.at, model.timeZone)}
          </small>
          {spec && (
            <button type="button" className="chn-next" onClick={(e) => openQuick(spec, e.currentTarget)}>
              <Zap size={13} aria-hidden /> {item.suggestion ? item.suggestion.text : "Fill this slot"}
            </button>
          )}
          {item.suggestion && (
            <button type="button" className="chn-linkbtn" onClick={(e) => openAdjust(item.suggestion!, e.currentTarget)}>
              Adjust
            </button>
          )}
        </div>
      );
    }
    case "suggestion":
      return (
        <div className="chn-sugline">
          <small>{item.suggestion.reason}</small>
          <button type="button" className="chn-next" onClick={(e) => openQuick(specFromSuggestion(item.suggestion, piece(item.suggestion.pieceKey), null), e.currentTarget)}>
            <Zap size={13} aria-hidden /> {item.text}
          </button>
          <button type="button" className="chn-linkbtn" onClick={(e) => openAdjust(item.suggestion, e.currentTarget)}>
            Adjust
          </button>
        </div>
      );
    case "todo":
      return (
        <label className="chn-todo">
          <input
            type="checkbox"
            checked={item.done}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              const r = await setTodoDoneAction(item.id, e.target.checked, scopeOrg);
              setBusy(false);
              if (r.ok) surface.connectors.onMutated?.();
            }}
          />
          <span>{item.text}</span>
        </label>
      );
  }
}

function MonthItem({ item }: { item: DayItem }) {
  const { openPiece } = useChannel();
  if (item.type === "event")
    return (
      <button type="button" className="chn-month-item is-event" onClick={() => openPiece(item.pieceKey)}>
        {item.title}
      </button>
    );
  if (item.type === "post")
    return (
      <button type="button" className="chn-month-item" data-state={item.state} onClick={() => item.pieceKey && openPiece(item.pieceKey)}>
        <OutletIcon outlet={item.outlets[0]!} state={item.state} size={11} /> {item.title}
      </button>
    );
  if (item.type === "slot")
    return (
      <span className="chn-month-item is-slot">
        <OutletIcon outlet={item.outlet} size={11} /> {outletLabel(item.outlet)} slot
      </span>
    );
  if (item.type === "todo") return <span className="chn-month-item">☐ {item.text}</span>;
  return null;
}

function AddTodo({ date }: { date: string | null }) {
  const { model, scopeOrg } = useChannel();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (!model.ready) return null;
  if (!open)
    return (
      <button type="button" className="chn-addtodo" onClick={() => setOpen(true)}>
        <Plus size={12} aria-hidden /> To-do
      </button>
    );
  return (
    <form
      className="chn-todo-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        const r = await addTodoAction({ text, date, scopeOrg });
        setBusy(false);
        if (r.ok === false) return setError(r.error);
        setText("");
        setOpen(false);
        router.refresh();
      }}
    >
      <label className="chn-sr" htmlFor={`todo-${date ?? "none"}`}>
        To-do
      </label>
      <input id={`todo-${date ?? "none"}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="What to do" maxLength={240} />
      <button type="submit" className="chn-btn is-small" disabled={!text.trim() || busy}>
        Add
      </button>
      {error && <small className="is-alert">{error}</small>}
    </form>
  );
}

function Tray({ items }: { items: TrayItem[] }) {
  const { openQuick, piece, model } = useChannel();
  return (
    <section className="chn-tray" aria-labelledby="chn-tray-h">
      <div className="chn-section-head">
        <h2 id="chn-tray-h" className="chn-kicker">
          Not placed yet · {items.length}
        </h2>
        <p className="chn-quiet">Drafts, gaps from the matrix and your own notes.</p>
      </div>
      {items.length === 0 ? (
        <p className="chn-empty-line">Nothing waiting to be placed.</p>
      ) : (
        <ul className="chn-tray-grid">
          {items.slice(0, 12).map((t) => (
            <li key={t.id} className="chn-tray-card">
              <div>
                <small className="chn-kicker">{t.label}</small>
                <strong>{t.title}</strong>
                <small>{t.sub}</small>
                {t.type === "gap" ? (
                  <button type="button" className="chn-next" onClick={(e) => openQuick(specFromSuggestion(t.suggestion, piece(t.pieceKey), null), e.currentTarget)}>
                    <Zap size={13} aria-hidden /> {t.chip}
                  </button>
                ) : t.type === "draft" && t.pieceKey ? (
                  <button
                    type="button"
                    className="chn-next"
                    onClick={(e) => {
                      const p = piece(t.pieceKey!);
                      if (!p) return;
                      openQuick({ title: t.title, kicker: t.label, pieceKey: p.key, outlet: t.outlet, identityId: p.ownerIdentityId, at: null, routineId: null, routineName: null, deliveryId: t.deliveryId }, e.currentTarget);
                    }}
                  >
                    <Zap size={13} aria-hidden /> {t.chip}
                  </button>
                ) : (
                  <a className="chn-next" href={model.links.writing}>
                    <Zap size={13} aria-hidden /> {t.chip}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddTodo date={null} />
    </section>
  );
}
