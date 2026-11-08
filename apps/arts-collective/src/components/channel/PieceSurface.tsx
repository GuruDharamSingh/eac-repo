"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, CalendarDays, ExternalLink, PenLine, Plug } from "lucide-react";
import { SurfaceFrame, useLayer, useSurface } from "@elkdonis/cms-ui/surface";
import { parsePlan } from "@elkdonis/services/channel-plan-md";
import {
  COVERAGE_COLUMNS,
  fmtDay,
  kindGlyph,
  kindLabel,
  pieceHref,
  type CoverageColumn,
  type Piece,
  type Suggestion,
} from "@/lib/channel/model";
import { acceptSuggestionAction, dismissSuggestionAction, savePlanAction, setPlanStepAction, startPlanAction } from "@/lib/channel/actions";
import { CHANNEL_BASE, suggestionInput, useChannel } from "./context";
import { IdentityMark, OutletIcon } from "./icons";
import { NextChip, StateMark, Thumb, Timeline } from "./bits";

const COVERAGE_ICON: Record<CoverageColumn, "site" | "instagram" | "facebook" | "market" | "newsletter"> = {
  site: "site",
  instagram: "instagram",
  facebook: "facebook",
  market: "market",
  newsletter: "newsletter",
};
const COVERAGE_LABEL: Record<CoverageColumn, string> = { site: "Page or site", instagram: "Instagram", facebook: "Facebook", market: "Market", newsletter: "Letter" };

/**
 * The piece pop-up (3a): opened from the face on Home, it grows from the card.
 * Overview = where it went and under which name; Plan = plan.md (3c) beside
 * the board's waiting suggestions.
 */
export function PieceSurface({ pieceKey, initialTab }: { pieceKey: string; initialTab: "overview" | "plan" }) {
  const { piece: find, identity, href, openLibrary, model } = useChannel();
  const piece = find(pieceKey);
  const [tab, setTab] = React.useState<"overview" | "plan">(initialTab);
  const layer = useLayer();

  React.useEffect(() => {
    if (piece) layer.setMeta({ title: piece.title });
  }, [piece, layer]);

  React.useEffect(() => {
    // Only the top layer owns the address (a piece beneath the library does not).
    if (!layer.isTop) return;
    const u = new URL(window.location.href);
    if (tab === "plan") u.searchParams.set("tab", "plan");
    else u.searchParams.delete("tab");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }, [tab, layer.isTop]);

  if (!piece) {
    return (
      <SurfaceFrame kind="neutral" title="Not found">
        <p className="chn-quiet">This piece is not in your channel.</p>
      </SurfaceFrame>
    );
  }

  const owner = identity(piece.ownerIdentityId);
  const presenter = identity(piece.presentedById);
  const waiting = piece.suggestions.length;

  return (
    <SurfaceFrame
      kind={piece.kind === "artwork" || piece.kind === "product" ? "product" : piece.kind === "writing" ? "post" : piece.kind === "video" ? "gallery" : piece.kind}
      kicker={
        <span className="chn-pk">
          <span>
            {kindGlyph(piece.kind)} {kindLabel(piece.kind)}
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
      title={piece.title}
      status={<span className="chn-mono">Esc closes</span>}
    >
      <div className="chn-ps">
        <header className="chn-ps-mast">
          <Thumb piece={piece} size={84} />
          <div>
            <p className="chn-ps-meta">{piece.meta}</p>
            <div className="chn-actions">
              <Link className="chn-btn is-primary" href={href(`${CHANNEL_BASE}/new`, { about: piece.key })}>
                <PenLine size={15} aria-hidden /> New post
              </Link>
              <Link className="chn-btn" href={href(pieceHref(CHANNEL_BASE, piece))}>
                <CalendarDays size={15} aria-hidden /> Board
              </Link>
              {piece.studioHref && (
                <a className="chn-btn" href={piece.studioHref}>
                  <ExternalLink size={15} aria-hidden /> Open in Studio
                </a>
              )}
              {piece.href && (
                <a className="chn-link" href={piece.href} target="_blank" rel="noreferrer">
                  View on {piece.siteName === "Your page" ? "your page" : piece.siteName} ↗
                </a>
              )}
              <button type="button" className="chn-linkbtn chn-ps-switch" onClick={() => openLibrary(piece.key)}>
                <ArrowLeftRight size={14} aria-hidden /> Switch piece
              </button>
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
              <h3 className="chn-kicker">Where it has gone</h3>
              <Timeline entries={piece.timeline} showIdentity />
            </section>
            <aside>
              <h3 className="chn-kicker">Coverage by identity</h3>
              <Coverage piece={piece} />
              {piece.suggestions.length > 0 && (
                <>
                  <h3 className="chn-kicker">Next for this piece</h3>
                  <div className="chn-chips is-stack">
                    {piece.suggestions.slice(0, 4).map((s) => (
                      <NextChip key={s.id} suggestion={s} piece={piece} />
                    ))}
                  </div>
                </>
              )}
            </aside>
          </div>
        ) : (
          <PlanTab piece={piece} />
        )}
        {!model.ready && tab === "plan" && <p className="chn-help">Plans are saved once migration 252 is applied.</p>}
      </div>
    </SurfaceFrame>
  );
}

function Coverage({ piece }: { piece: Piece }) {
  const { model } = useChannel();
  const ids = model.identities.filter((i) => piece.coverage[i.id]);
  return (
    <table className="chn-cov">
      <thead>
        <tr>
          <th scope="col">
            <span className="chn-sr">Identity</span>
          </th>
          {COVERAGE_COLUMNS.map((c) => (
            <th key={c} scope="col" title={COVERAGE_LABEL[c]}>
              <OutletIcon outlet={COVERAGE_ICON[c]} size={14} title={COVERAGE_LABEL[c]} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ids.map((i) => (
          <tr key={i.id}>
            <th scope="row">
              <IdentityMark initials={i.initials} kind={i.kind} size={18} /> {i.kind === "user" ? "You" : i.shortName}
            </th>
            {COVERAGE_COLUMNS.map((c) => {
              const cell = piece.coverage[i.id]![c];
              return (
                <td key={c}>
                  {cell.state !== "empty" ? (
                    <span className="chn-cov-cell">
                      <StateMark state={cell.state} />
                      <small>{fmtDay(cell.at, model.timeZone)}</small>
                    </span>
                  ) : cell.suggestion ? (
                    <NextChip suggestion={cell.suggestion} piece={piece} compact />
                  ) : (
                    <span className="chn-none" aria-label="Not yet">
                      —
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlanTab({ piece }: { piece: Piece }) {
  const { model, scopeOrg, href, openAdjust } = useChannel();
  const surface = useSurface();
  const [mode, setMode] = React.useState<"read" | "markdown">("read");
  const [draft, setDraft] = React.useState(piece.plan?.bodyMd ?? "");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Take a newer stored plan only while nothing unsaved is in the editor.
  const seen = React.useRef(piece.plan?.bodyMd ?? "");
  React.useEffect(() => {
    const next = piece.plan?.bodyMd ?? "";
    setDraft((d) => (d === seen.current ? next : d));
    seen.current = next;
  }, [piece.plan?.bodyMd]);
  const plan = piece.plan ? parsePlan(piece.plan.bodyMd) : null;
  const refresh = () => surface.connectors.onMutated?.();

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (r.ok === false) setError((r as { error: string }).error);
    else refresh();
  }

  const accept = (s: Suggestion) => run(`a:${s.id}`, () => acceptSuggestionAction(suggestionInput(s, scopeOrg)));
  const dismiss = (s: Suggestion) => run(`d:${s.id}`, () => dismissSuggestionAction(suggestionInput(s, scopeOrg)));

  return (
    <div className="chn-plan">
      <section className="chn-plan-doc">
        <div className="chn-plan-head">
          <strong className="chn-mono">plan.md</strong>
          <small>
            {piece.plan
              ? `Started ${fmtDay(piece.plan.createdAt, model.timeZone)}, when this joined the queue · last edited by ${
                  piece.plan.updatedByActor === "agent" ? "an agent" : piece.plan.updatedByViewer ? "you" : "someone else"
                }, ${fmtDay(piece.plan.updatedAt, model.timeZone)}`
              : "Starts the day this piece joins the queue, empty, and fills as you accept suggestions."}
          </small>
          {piece.plan && (
            <div className="chn-seg" role="group" aria-label="View">
              <button type="button" aria-pressed={mode === "read"} onClick={() => setMode("read")}>
                Read
              </button>
              <button type="button" aria-pressed={mode === "markdown"} onClick={() => setMode("markdown")}>
                Markdown
              </button>
            </div>
          )}
        </div>
        {!piece.plan ? (
          <div className="chn-paper is-empty">
            <p>No plan yet.</p>
            <button type="button" className="chn-btn" disabled={!model.ready || busy !== null} onClick={() => run("start", () => startPlanAction(piece.key, piece.ownerIdentityId, scopeOrg))}>
              Start plan.md
            </button>
          </div>
        ) : mode === "markdown" ? (
          <div className="chn-paper">
            <label className="chn-sr" htmlFor="plan-md">
              plan.md
            </label>
            <textarea id="plan-md" className="chn-md" value={draft} onChange={(e) => setDraft(e.target.value)} rows={16} spellCheck />
            <div className="chn-actions">
              <button
                type="button"
                className="chn-btn is-primary"
                disabled={busy !== null || draft === piece.plan.bodyMd}
                onClick={() => run("save", () => savePlanAction(piece.key, piece.ownerIdentityId, scopeOrg, draft, piece.plan!.updatedAt))}
              >
                Save plan
              </button>
              <button type="button" className="chn-btn" disabled={draft === piece.plan.bodyMd} onClick={() => setDraft(piece.plan!.bodyMd)}>
                Revert
              </button>
            </div>
          </div>
        ) : (
          <div className="chn-paper">
            <h4 className="chn-kicker">Goal</h4>
            <p>{plan!.goal || <span className="chn-quiet">Not written yet.</span>}</p>
            <h4 className="chn-kicker">Dates</h4>
            {plan!.dates.length ? (
              <ul className="chn-plain">
                {plan!.dates.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            ) : (
              <p className="chn-quiet">None yet.</p>
            )}
            <h4 className="chn-kicker">Steps</h4>
            {plan!.steps.length ? (
              <ul className="chn-steps">
                {plan!.steps.map((s) => (
                  <li key={s.index}>
                    <label>
                      <input
                        type="checkbox"
                        checked={s.done}
                        disabled={busy !== null}
                        onChange={(e) => run(`s:${s.index}`, () => setPlanStepAction(piece.key, piece.ownerIdentityId, scopeOrg, s.index, e.target.checked, s.text))}
                      />
                      <span>{s.text}</span>
                    </label>
                    <small>{s.fromBoard ? "from the board" : s.on ? fmtDay(`${s.on}T12:00:00Z`, "UTC") : "your step"}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="chn-quiet">Accept a suggestion and it lands here.</p>
            )}
            <h4 className="chn-kicker">Notes</h4>
            <p className="chn-notes-text">{plan!.notes || <span className="chn-quiet">None.</span>}</p>
          </div>
        )}
        {error && (
          <p className="chn-help is-alert" role="alert">
            {error}
          </p>
        )}
      </section>

      <aside className="chn-board-side">
        <div className="chn-section-head">
          <h3 className="chn-kicker">From the board</h3>
          <small>{piece.suggestions.length} waiting</small>
        </div>
        {piece.suggestions.length === 0 ? (
          <p className="chn-quiet">Nothing waiting. Every outlet this piece can go to has something on it.</p>
        ) : (
          <ul className="chn-sugs">
            {piece.suggestions.map((s) => (
              <li key={s.id} className="chn-sug">
                <strong>
                  {s.text}
                  {s.at ? ` · ${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: model.timeZone }).format(new Date(s.at))}` : ""}
                </strong>
                <small>{s.reason}</small>
                <div className="chn-actions">
                  <button type="button" className="chn-btn is-small" disabled={!model.ready || busy !== null} onClick={() => accept(s)}>
                    Accept
                  </button>
                  <button type="button" className="chn-linkbtn" disabled={!model.ready || busy !== null} onClick={(e) => openAdjust(s, e.currentTarget)}>
                    Adjust
                  </button>
                  <button type="button" className="chn-linkbtn" disabled={!model.ready || busy !== null} onClick={() => dismiss(s)}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="chn-registry">
          <Plug size={14} aria-hidden /> Every change to plan.md is recorded with who made it, a person or an agent.
        </p>
        <Link className="chn-link" href={href(pieceHref(CHANNEL_BASE, piece))}>
          <CalendarDays size={13} aria-hidden /> Open this piece's board
        </Link>
      </aside>
    </div>
  );
}
