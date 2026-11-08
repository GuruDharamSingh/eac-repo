"use client";

import * as React from "react";
import { CalendarDays, Plug } from "lucide-react";
import { useSurface } from "@elkdonis/cms-ui/surface";
import { parsePlan } from "@elkdonis/services/channel-plan-md";
import { fmtDay, type ContentPlanPanel, type ContentSuggestion } from "../../model";
import { AppLink, useContentConnectors, type ContentActResult } from "../connectors";

/** plan.md (read and Markdown modes, step ticks) beside the board's waiting suggestions. */
export function PlanPanel({ data, boardHref, timeZone }: { data: ContentPlanPanel; boardHref: string | null; timeZone: string }) {
  const { act, adjustSuggestion } = useContentConnectors();
  const surface = useSurface();
  const { plan: stored, ready, suggestions } = data;
  const [mode, setMode] = React.useState<"read" | "markdown">("read");
  const [draft, setDraft] = React.useState(stored?.bodyMd ?? "");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Take a newer stored plan only while nothing unsaved is in the editor.
  const seen = React.useRef(stored?.bodyMd ?? "");
  React.useEffect(() => {
    const next = stored?.bodyMd ?? "";
    setDraft((d) => (d === seen.current ? next : d));
    seen.current = next;
  }, [stored?.bodyMd]);
  const plan = stored ? parsePlan(stored.bodyMd) : null;
  const refresh = () => surface.connectors.onMutated?.();

  async function run(key: string, fn: () => Promise<ContentActResult>) {
    setBusy(key);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (r.ok === false) setError((r as { error: string }).error);
    else refresh();
  }

  const accept = (s: ContentSuggestion) => run(`a:${s.id}`, () => act("suggestion.accept", { suggestion: s }));
  const dismiss = (s: ContentSuggestion) => run(`d:${s.id}`, () => act("suggestion.dismiss", { suggestion: s }));

  return (
    <div className="chn-plan">
      <section className="chn-plan-doc">
        <div className="chn-plan-head">
          <strong className="chn-mono">plan.md</strong>
          <small>
            {stored
              ? `Started ${fmtDay(stored.createdAt, timeZone)}, when this joined the queue · last edited by ${
                  stored.updatedByActor === "agent" ? "an agent" : stored.updatedByViewer ? "you" : "someone else"
                }, ${fmtDay(stored.updatedAt, timeZone)}`
              : "Starts the day this piece joins the queue, empty, and fills as you accept suggestions."}
          </small>
          {stored && (
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
        {!stored ? (
          <div className="chn-paper is-empty">
            <p>No plan yet.</p>
            <button type="button" className="chn-btn" disabled={!ready || busy !== null} onClick={() => run("start", () => act("plan.start", {}))}>
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
                disabled={busy !== null || draft === stored.bodyMd}
                onClick={() => run("save", () => act("plan.save", { bodyMd: draft, expectedUpdatedAt: stored.updatedAt }))}
              >
                Save plan
              </button>
              <button type="button" className="chn-btn" disabled={draft === stored.bodyMd} onClick={() => setDraft(stored.bodyMd)}>
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
                        onChange={(e) => run(`s:${s.index}`, () => act("plan.step", { index: s.index, done: e.target.checked, text: s.text }))}
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
          <small>{suggestions.length} waiting</small>
        </div>
        {suggestions.length === 0 ? (
          <p className="chn-quiet">Nothing waiting. Every outlet this piece can go to has something on it.</p>
        ) : (
          <ul className="chn-sugs">
            {suggestions.map((s) => (
              <li key={s.id} className="chn-sug">
                <strong>
                  {s.text}
                  {s.at ? ` · ${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(new Date(s.at))}` : ""}
                </strong>
                <small>{s.reason}</small>
                <div className="chn-actions">
                  <button type="button" className="chn-btn is-small" disabled={!ready || busy !== null} onClick={() => accept(s)}>
                    Accept
                  </button>
                  <button type="button" className="chn-linkbtn" disabled={!ready || busy !== null} onClick={(e) => adjustSuggestion?.(s, e.currentTarget)}>
                    Adjust
                  </button>
                  <button type="button" className="chn-linkbtn" disabled={!ready || busy !== null} onClick={() => dismiss(s)}>
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
        {boardHref && (
          <AppLink className="chn-link" href={boardHref}>
            <CalendarDays size={13} aria-hidden /> Open this piece's board
          </AppLink>
        )}
      </aside>
    </div>
  );
}
