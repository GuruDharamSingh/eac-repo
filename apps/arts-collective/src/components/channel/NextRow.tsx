"use client";

import * as React from "react";
import { ArrowUpRight, Zap } from "lucide-react";
import type { ActionResult } from "@elkdonis/actions";
import { runAction } from "@/lib/actions/run";
import { setTodoDoneAction } from "@/lib/channel/actions";
import { channelNextMoves, type ChannelNext } from "@/lib/channel/next";
import type { Outlet } from "@/lib/channel/model";
import { useChannel } from "./context";
import { OutletIcon } from "./icons";
import "./next.css";

// ============================================================================
// Channel Home's next row (2026-11-07): in place of 1a's four count bands, the
// three to five moves that come next on the board (lib/channel/next.ts), each
// a short card with one button and one way in:
//   button  the move's registry entry through this host's runAction (via
//           'app': channel-suggestion-accept, channel-plan-step), or a to-do's
//           setTodoDoneAction; a draft or a slot without a piece has none
//   open    the quick sheet, the piece (or its Plan tab), the Studio, the
//           booth or the queue
// The dock shows the first of these same moves on Channel's other pages.
// Returns nothing when nothing is waiting (rule: empty faces return null).
// docs/open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md.
// ============================================================================

export function NextRow({ moves: given, limit = 4 }: { moves?: ChannelNext[]; limit?: number }) {
  const { model } = useChannel();
  const all = React.useMemo(() => given ?? channelNextMoves(model, { limit: limit + 2 }), [given, model, limit]);
  // Setup moves are immediate suggestions, drawn as pale-blue chips above the cards (owner,
  // 2026-11-07: no course-style onboarding here, only the immediate button as a light suggestion).
  const setup = all.filter((m) => m.kind === "setup");
  const moves = all.filter((m) => m.kind !== "setup").slice(0, limit);
  // Kept at the row: the card that was acted on leaves the row once the page refreshes.
  const [status, setStatus] = React.useState<{ text: string; alert: boolean } | null>(null);
  if (moves.length === 0 && setup.length === 0) return status ? <Status status={status} /> : null;
  return (
    <section className="chn-nx" aria-labelledby="chn-nx-h">
      <h2 id="chn-nx-h" className="chn-sr">
        Next moves
      </h2>
      {setup.length > 0 && (
        <p className="chn-nx-suggest">
          {setup.map((m) => (
            <a key={m.id} className="chn-next" href={m.href ?? "#"} title={m.reason ?? undefined}>
              <Zap size={13} aria-hidden /> {m.title}
            </a>
          ))}
        </p>
      )}
      {moves.length > 0 && (
      <ul className="chn-nx-row">
        {moves.map((m) => (
          <li key={m.id}>
            <NextCard move={m} onDone={setStatus} />
          </li>
        ))}
      </ul>
      )}
      <Status status={status} />
    </section>
  );
}

function Status({ status }: { status: { text: string; alert: boolean } | null }) {
  return (
    <p className={`chn-nx-status${status?.alert ? " is-alert" : ""}`} role="status">
      {status?.text ?? ""}
    </p>
  );
}

const DONE_TEXT: Record<string, string> = {
  "channel-suggestion-accept": "is on the queue as a draft, and in its plan.",
  "channel-plan-step": "is ticked in its plan.",
};

function NextCard({ move, onDone }: { move: ChannelNext; onDone: (s: { text: string; alert: boolean }) => void }) {
  const { scopeOrg, openPiece, openQuick, openAdjust, suggestionById, surface } = useChannel();
  // A move that came from a suggestion can be adjusted when it is presented (the planner).
  const suggestion = move.id.startsWith("sug:") ? suggestionById(move.id.slice(4)) : undefined;
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLElement>(null);
  const label = move.todoId ? "Done" : move.run?.label ?? null;

  async function perform() {
    if (busy) return;
    setBusy(true);
    const call = (move.todoId ? setTodoDoneAction(move.todoId, true, scopeOrg) : runAction(move.run!.id, move.run!.input, { org: scopeOrg })) as Promise<{ ok: boolean; error?: string }>;
    const r: { ok: boolean; error?: string } = await call.catch((): ActionResult => ({ ok: false, error: "Could not reach the server." }));
    setBusy(false);
    if (r.ok === false) return onDone({ text: r.error ?? "That did not save.", alert: true });
    onDone({ text: `“${move.title}” ${move.todoId ? "is done." : DONE_TEXT[move.run!.id] ?? "is done."}`, alert: false });
    surface.connectors.onMutated?.();
  }

  const open = move.open;
  let way: React.ReactNode = null;
  if (open && (open.kind === "sheet" || open.kind === "piece" || open.kind === "plan")) {
    const can = open.kind === "sheet" ? Boolean(move.sheet) : Boolean(move.pieceKey);
    if (can)
      way = (
        <button
          type="button"
          className="chn-nx-open"
          onClick={(e) => {
            if (open.kind === "sheet") openQuick(move.sheet!, e.currentTarget);
            else openPiece(move.pieceKey!, ref.current, open.kind === "plan" ? "plan" : "overview");
          }}
        >
          {open.label}
        </button>
      );
  } else if (open && move.href) {
    way = (
      <a className="chn-nx-open" href={move.href}>
        {open.label} <ArrowUpRight size={12} aria-hidden />
      </a>
    );
  }

  return (
    <article ref={ref} className="chn-nx-card" data-kind={move.kind} data-urgent={move.urgent ? "1" : "0"}>
      <p className="chn-nx-kicker">
        {move.outlet && <OutletIcon outlet={move.outlet as Outlet} size={13} state={move.kind === "live" ? "live" : "scheduled"} />}
        <span>{move.kicker}</span>
      </p>
      <h3 className="chn-nx-title">{move.title}</h3>
      {move.reason && <p className="chn-nx-reason">{move.reason}</p>}
      {(label || way || suggestion) && (
        <div className="chn-nx-acts">
          {label && (
            <button type="button" className="chn-nx-run" disabled={busy} onClick={perform}>
              <Zap size={12} aria-hidden /> {busy ? move.run?.busyLabel ?? "Saving…" : label}
            </button>
          )}
          {way}
          {suggestion && (
            <button type="button" className="chn-nx-open" onClick={(e) => openAdjust(suggestion, e.currentTarget)}>
              Adjust
            </button>
          )}
        </div>
      )}
    </article>
  );
}
