"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@elkdonis/actions";
import { fromZonedInput, toZonedInput, type Suggestion } from "../model";

/**
 * The Channel moves a site performs itself (2026-11-14; canvas D Queue, D2 Board): Accept,
 * Plan it, Dismiss on a suggestion; Fill the slot; Plan it on a piece; the Home tab's Next row.
 * Every one goes through the site's own Channel door, a server action the site hands to
 * <ChannelDoor run={…}> (performSiteChannelAction for the site's org). Plans only: nothing
 * here schedules or sends.
 */

type Run = (id: string, input: unknown) => Promise<ActionResult>;
const DoorContext = React.createContext<Run | null>(null);

/** Wraps a site's Channel page; `run` is the site's "use server" door. */
export function ChannelDoor({ run, children }: { run: Run; children: React.ReactNode }) {
  return <DoorContext.Provider value={run}>{children}</DoorContext.Provider>;
}

type Note = { text: string; alert: boolean } | null;

function useRun() {
  const door = React.useContext(DoorContext);
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<Note>(null);
  const run = async (key: string, id: string, input: Record<string, unknown>, done: string): Promise<boolean> => {
    if (busy) return false;
    if (!door) {
      setNote({ text: "This cannot be done from here.", alert: true });
      return false;
    }
    setBusy(key);
    setNote(null);
    try {
      const r = await door(id, input);
      if (r.ok === false) {
        setNote({ text: r.error ?? "That did not work. Try again.", alert: true });
        return false;
      }
      setNote({ text: done, alert: false });
      router.refresh();
      return true;
    } catch {
      setNote({ text: "That did not work. Try again.", alert: true });
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, note, run };
}

export function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p className="kch-fine kch-note" role={note.alert ? "alert" : "status"} data-alert={note.alert ? "1" : undefined}>
      {note.text}
    </p>
  );
}

/** One suggestion row (D): the sentence, when and why, then Accept · Plan it · ✕. */
export function SuggestionRow({ s, when, timeZone }: { s: Suggestion; when: string; timeZone: string }) {
  const { busy, note, run } = useRun();
  const [planning, setPlanning] = React.useState(false);
  const [at, setAt] = React.useState(() => toZonedInput(s.at, timeZone));
  const base = { pieceKey: s.pieceKey, outlet: s.outlet, identityId: s.identityId, text: s.text };

  const accept = (placed: string | null) =>
    run("accept", "channel-suggestion-accept", { ...base, at: placed, routineId: placed === s.at ? s.routineId : null }, "On the Board as a planned draft.");

  return (
    <div className="kch-sg">
      <div className="kch-sg-line">
        <span className="kch-sg-text">
          {s.text}
          <br />
          <span className="kch-fine">{[when, s.reason].filter(Boolean).join(" · ")}</span>
        </span>
        <button type="button" className="kch-btn kch-btn--sm" disabled={busy !== null} onClick={() => accept(s.at)}>
          {busy === "accept" ? "Adding…" : "Accept"}
        </button>
        <button type="button" className="kch-btn kch-btn--ghost kch-btn--sm" aria-expanded={planning} disabled={busy !== null} onClick={() => setPlanning((v) => !v)}>
          Plan it
        </button>
        <button
          type="button"
          className="kch-icon-btn"
          aria-label={`Dismiss: ${s.text}`}
          disabled={busy !== null}
          onClick={() => run("dismiss", "channel-suggestion-dismiss", base, "Dismissed. It won't be suggested again.")}
        >
          ✕
        </button>
      </div>
      {planning ? (
        <form
          className="kch-sg-plan"
          onSubmit={async (e) => {
            e.preventDefault();
            const iso = at ? fromZonedInput(at, timeZone) : null;
            if (await accept(iso)) setPlanning(false);
          }}
        >
          <label>
            <span className="kch-fine">When it goes out</span>
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
          <button type="submit" className="kch-btn kch-btn--sm" disabled={busy !== null}>
            {busy === "accept" ? "Adding…" : "Put it on the Board"}
          </button>
          <span className="kch-fine">Saved as a planned draft; nothing is posted.</span>
        </form>
      ) : null}
      <NoteLine note={note} />
    </div>
  );
}

/** A single registry move as a button (Fill the slot, Plan it on a piece). */
export function RunButton({
  id,
  input,
  label,
  busyLabel,
  done,
  ghost,
}: {
  id: string;
  input: Record<string, unknown>;
  label: string;
  busyLabel: string;
  done: string;
  ghost?: boolean;
}) {
  const { busy, note, run } = useRun();
  return (
    <>
      <button type="button" className={`kch-btn kch-btn--sm${ghost ? " kch-btn--ghost" : ""}`} disabled={busy !== null} onClick={() => run("go", id, input, done)}>
        {busy ? busyLabel : label}
      </button>
      <NoteLine note={note} />
    </>
  );
}

/** One next move as the page hands it over: the shared Channel's ChannelNextMove, links resolved for the site. */
export interface SiteMove {
  id: string;
  kicker: string;
  title: string;
  reason: string | null;
  run: null | { id: string; input: Record<string, unknown>; label: string; busyLabel: string };
  /** Where to finish it when there is no run here (network Channel or Studio, through the hand-off). */
  openHref: string | null;
  openLabel: string;
}

const MOVE_DONE: Record<string, string> = {
  "channel-suggestion-accept": "is on the Board as a draft.",
  "channel-slot-fill": "is in the slot as a draft.",
  "channel-plan-step": "is ticked in the plan.",
  "channel-plan": "has a plan.",
};

function MoveCard({ m }: { m: SiteMove }) {
  const { busy, note, run } = useRun();
  return (
    <li className="kch-move">
      <p className="kch-move-kicker">{m.kicker}</p>
      <p className="kch-move-title">{m.title}</p>
      {m.reason ? <p className="kch-row-meta">{m.reason}</p> : null}
      <div className="kch-move-actions">
        {m.run ? (
          <button type="button" className="kch-btn kch-btn--sm" disabled={busy !== null} onClick={() => m.run && run("go", m.run.id, m.run.input, `“${m.title}” ${MOVE_DONE[m.run.id] ?? "is done."}`)}>
            {busy ? m.run.busyLabel : m.run.label}
          </button>
        ) : null}
        {m.openHref ? (
          <a className="kch-btn kch-btn--ghost kch-btn--sm" href={m.openHref}>
            {m.openLabel} ↗
          </a>
        ) : null}
        <NoteLine note={note} />
      </div>
    </li>
  );
}

/** Channel Home's Next row: the same moves, from the same reader, as arts-collective's Channel Home. */
export function NextMoves({ moves }: { moves: SiteMove[] }) {
  return (
    <ul className="kch-moves">
      {moves.map((m) => (
        <MoveCard key={m.id} m={m} />
      ))}
    </ul>
  );
}

/** The hook the grid's cell forms use: the site's door, busy state and the note line. */
export function useChannelRun() {
  return useRun();
}

/** One piece's plan steps (Queue by piece): tick, add a step, or let Channel propose them (Plan it). Plans only. */
export function PieceSteps({ pieceKey, identityId, steps }: { pieceKey: string; identityId: string; steps: Array<{ index: number; text: string; done: boolean; on: string | null }> }) {
  const { busy, note, run } = useRun();
  const [text, setText] = React.useState("");
  const [on, setOn] = React.useState("");
  const base = { pieceKey, identityId };
  return (
    <div className="kch-steps">
      {steps.length === 0 ? <p className="kch-fine">No steps yet. Add one, or let Plan it propose them from the Queue&rsquo;s rules.</p> : null}
      <ul className="kch-steps-list">
        {steps.map((s) => (
          <li key={s.index}>
            <label>
              <input
                type="checkbox"
                checked={s.done}
                disabled={busy !== null}
                onChange={() => run(`s${s.index}`, "channel-plan-step", { ...base, op: s.done ? "uncheck" : "check", index: s.index, text: s.text }, s.done ? "Step opened again." : "Step done.")}
              />
              <span data-done={s.done ? "1" : undefined}>{s.text}</span>
              {s.on ? <span className="kch-fine"> · {s.on}</span> : null}
            </label>
          </li>
        ))}
      </ul>
      <form
        className="kch-steps-add"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run("add", "channel-plan-step", { ...base, op: "add", text: text.trim(), on: on || null }, "Step added.")) {
            setText("");
            setOn("");
          }
        }}
      >
        <label className="kch-sr" htmlFor="kch-step-text">
          New step
        </label>
        <input id="kch-step-text" value={text} placeholder="Add a step" maxLength={300} onChange={(e) => setText(e.target.value)} />
        <label className="kch-sr" htmlFor="kch-step-on">
          On
        </label>
        <input id="kch-step-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
        <button type="submit" className="kch-btn kch-btn--sm" disabled={busy !== null || !text.trim()}>
          {busy === "add" ? "Adding…" : "Add step"}
        </button>
        <button type="button" className="kch-btn kch-btn--ghost kch-btn--sm" disabled={busy !== null} onClick={() => run("plan", "channel-plan", base, "Planned: the proposed steps are in.")}>
          {busy === "plan" ? "Planning…" : "Plan it"}
        </button>
      </form>
      <NoteLine note={note} />
    </div>
  );
}

/** A suggestion's moves without its sentence (the pop-up's "Next for this piece" lays the sentence out): Accept · Plan it · ✕. */
export function SuggestionActs({ s, timeZone }: { s: Suggestion; timeZone: string }) {
  const { busy, note, run } = useRun();
  const [planning, setPlanning] = React.useState(false);
  const [at, setAt] = React.useState(() => toZonedInput(s.at, timeZone));
  const base = { pieceKey: s.pieceKey, outlet: s.outlet, identityId: s.identityId, text: s.text };
  const accept = (placed: string | null) =>
    run("accept", "channel-suggestion-accept", { ...base, at: placed, routineId: placed === s.at ? s.routineId : null }, "Planned: a draft on the Board.");
  return (
    <span className="kch-acts">
      <button type="button" className="kch-btn kch-btn--sm" disabled={busy !== null} onClick={() => accept(s.at)}>
        {busy === "accept" ? "Adding…" : "Accept"}
      </button>
      <button type="button" className="kch-btn kch-btn--ghost kch-btn--sm" aria-expanded={planning} disabled={busy !== null} onClick={() => setPlanning((v) => !v)}>
        Plan it
      </button>
      <button type="button" className="kch-icon-btn" aria-label={`Dismiss: ${s.text}`} disabled={busy !== null} onClick={() => run("dismiss", "channel-suggestion-dismiss", base, "Dismissed.")}>
        ✕
      </button>
      {planning ? (
        <form
          className="kch-sg-plan"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await accept(at ? fromZonedInput(at, timeZone) : null)) setPlanning(false);
          }}
        >
          <label>
            <span className="kch-fine">When it goes out</span>
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
          <button type="submit" className="kch-btn kch-btn--sm" disabled={busy !== null}>
            Save as a plan
          </button>
        </form>
      ) : null}
      <NoteLine note={note} />
    </span>
  );
}

/** One plan step's tick in the manage-piece pop-up's Plan box (channel-plan-step check / uncheck). */
export function StepCheck({ pieceKey, identityId, index, text, done }: { pieceKey: string; identityId: string; index: number; text: string; done: boolean }) {
  const { busy, note, run } = useRun();
  return (
    <span className="kch-acts">
      <input
        type="checkbox"
        className="kch-step-check"
        checked={done}
        disabled={busy !== null}
        aria-label={done ? `Open again: ${text}` : `Done: ${text}`}
        onChange={() => run("tick", "channel-plan-step", { pieceKey, identityId, op: done ? "uncheck" : "check", index, text }, done ? "Opened again." : "Done.")}
      />
      {note?.alert ? <NoteLine note={note} /> : null}
    </span>
  );
}

/** The Plan box's actions: add a step (optionally dated), and Start the plan / Propose steps (channel-plan). */
export function PlanActions({ pieceKey, identityId, started }: { pieceKey: string; identityId: string; started: boolean }) {
  const { busy, note, run } = useRun();
  const [text, setText] = React.useState("");
  const [on, setOn] = React.useState("");
  const base = { pieceKey, identityId };
  return (
    <div className="kch-plan-acts">
      <form
        className="kch-steps-add"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run("add", "channel-plan-step", { ...base, op: "add", text: text.trim(), on: on || null }, "Step added.")) {
            setText("");
            setOn("");
          }
        }}
      >
        <label className="kch-sr" htmlFor={`kch-plan-text-${pieceKey}`}>
          New step
        </label>
        <input id={`kch-plan-text-${pieceKey}`} value={text} placeholder="Add a step" maxLength={300} onChange={(e) => setText(e.target.value)} />
        <label className="kch-sr" htmlFor={`kch-plan-on-${pieceKey}`}>
          On
        </label>
        <input id={`kch-plan-on-${pieceKey}`} type="date" value={on} onChange={(e) => setOn(e.target.value)} />
        <button type="submit" className="kch-btn kch-btn--sm" disabled={busy !== null || !text.trim()}>
          {busy === "add" ? "Adding…" : "Add"}
        </button>
      </form>
      <button type="button" className="kch-btn kch-btn--ghost kch-btn--sm" disabled={busy !== null} onClick={() => run("plan", "channel-plan", base, started ? "Steps proposed." : "Plan started.")}>
        {busy === "plan" ? "Working…" : started ? "Propose steps" : "Start the plan"}
      </button>
      <NoteLine note={note} />
    </div>
  );
}
