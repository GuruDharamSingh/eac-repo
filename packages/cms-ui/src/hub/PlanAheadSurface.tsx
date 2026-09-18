"use client";

import * as React from "react";
import { SurfaceFrame, fmtDateTime, useSurface } from "../surface";

/**
 * The rota for a recurring gathering: who is running each of the coming
 * occurrences, and what happened at the last one.
 *
 * This exists because a standing meeting shared between five people is not
 * one event repeated — it is a sequence of occasions with a different person
 * responsible for each, and nothing in a single `threads` row can say that.
 * The card shows who has the NEXT one; this shows the run, which is the view
 * you need to volunteer for a week or notice that three Mondays have nobody.
 *
 * Read-only for a member, editable for whoever runs the org. A member seeing
 * the rota matters: knowing who is hosting is most of the value, and hiding it
 * behind an edit permission would leave four of the five people unable to see
 * their own turn.
 */

export interface PlanAheadOccurrence {
  at: string;
  isPast?: boolean;
  host: { userId: string | null; displayName: string | null; note: string | null } | null;
  hasRecord: boolean;
}

export interface PlanAheadCandidate {
  userId: string;
  displayName: string;
}

export interface PlanAheadData {
  title: string;
  occurrences: PlanAheadOccurrence[];
  candidates: PlanAheadCandidate[];
  canPlan: boolean;
}

const DEFAULT_ENDPOINT = "/api/hub/meeting/rota";
const DEFAULT_RECORD_ENDPOINT = "/api/hub/meeting/record";

interface AttendanceSuggestion {
  actorId?: string | null;
  userId?: string | null;
  name: string;
  source: "call" | "chat" | "rsvp" | "manual";
}

export function PlanAheadSurface({
  threadId,
  canPlan = false,
  endpoint = DEFAULT_ENDPOINT,
  recordEndpoint = DEFAULT_RECORD_ENDPOINT,
  timeZone,
}: {
  threadId: string;
  canPlan?: boolean;
  endpoint?: string;
  recordEndpoint?: string;
  timeZone?: string;
}) {
  const surfaces = useSurface();
  const tz = timeZone ? { timeZone } : {};
  const [data, setData] = React.useState<PlanAheadData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [savingAt, setSavingAt] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${endpoint}?threadId=${encodeURIComponent(threadId)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not load the rota.");
        return;
      }
      setData(body as PlanAheadData);
    } catch {
      setError("Could not reach the server.");
    }
  }, [endpoint, threadId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function assign(at: string, userId: string | null) {
    setSavingAt(at);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, occurrenceAt: at, role: "host", userId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "That did not save.");
        return;
      }
      // Re-read rather than patching in place: the server is what decides
      // whether an assignment stuck, and a rota that disagrees with it is
      // worse than one that takes a moment to refresh.
      await load();
      surfaces.connectors.onMutated?.();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSavingAt(null);
    }
  }

  const editable = canPlan && (data?.canPlan ?? false);

  return (
    <SurfaceFrame
      kind="meeting"
      kicker="Plan ahead"
      title={data?.title || "The rota"}
      status={error ?? undefined}
      statusTone={error ? "error" : "normal"}
    >
      {!data ? (
        <p className="eac-rota-empty">Reading the rota…</p>
      ) : data.occurrences.length === 0 ? (
        <p className="eac-rota-empty">
          This gathering does not repeat, so there is nothing to plan. Give it a
          weekly or monthly pattern and its occurrences will appear here.
        </p>
      ) : (
        <>
          <p className="eac-rota-intro">
            {editable
              ? "Who is running each one. Anybody in the group can take a week."
              : "Who is running each one."}
          </p>
          <ol className="eac-rota">
            {data.occurrences.map((occurrence) => {
              const when = new Date(occurrence.at);
              const busy = savingAt === occurrence.at;
              return (
                <li
                  key={occurrence.at}
                  className={"eac-rota__row" + (occurrence.isPast ? " eac-rota__row--past" : "")}
                >
                  <div className="eac-rota__when">
                    <strong>{fmtDateTime(when, tz)}</strong>
                    {occurrence.hasRecord && (
                      <span className="eac-rota__flag">Notes taken</span>
                    )}
                  </div>

                  {editable && !occurrence.isPast ? (
                    <label className="eac-rota__pick">
                      <span className="eac-rota__pick-label">Host</span>
                      <select
                        className="eac-input"
                        value={occurrence.host?.userId ?? ""}
                        disabled={busy}
                        onChange={(e) => void assign(occurrence.at, e.target.value || null)}
                      >
                        {/* "" is the real, meaningful option here — nobody has
                            this week — so it carries a word rather than being
                            an empty row. */}
                        <option value="">Nobody yet</option>
                        {data.candidates.map((c) => (
                          <option key={c.userId} value={c.userId}>
                            {c.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span
                      className={
                        "eac-rota__host" +
                        (occurrence.host?.displayName ? "" : " eac-rota__host--none")
                      }
                    >
                      {occurrence.host?.displayName ?? "No host yet"}
                    </span>
                  )}

                  {occurrence.isPast && (
                    <OccurrenceRecord
                      threadId={threadId}
                      at={occurrence.at}
                      endpoint={recordEndpoint}
                      onSaved={() => void load()}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </SurfaceFrame>
  );
}

/**
 * What happened at an occurrence that has already been and gone.
 *
 * Collapsed until asked for: most of the rota is forward-looking, and a note
 * field open against every past week would bury the plan under paperwork.
 *
 * The Talk suggestion is offered, never applied. Each name says where it came
 * from — a person Talk saw JOIN THE CALL is different evidence from one who
 * only typed in the chat, and neither is the same as the host saying "these
 * people were here". Accepting is a click; it is the click that makes it a
 * record.
 */
function OccurrenceRecord({
  threadId,
  at,
  endpoint,
  onSaved,
}: {
  threadId: string;
  at: string;
  endpoint: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [attended, setAttended] = React.useState<AttendanceSuggestion[]>([]);
  const [suggested, setSuggested] = React.useState<AttendanceSuggestion[]>([]);
  const [scanned, setScanned] = React.useState<number | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);

  async function openPanel() {
    setOpen(true);
    setLoading(true);
    setProblem(null);
    try {
      const res = await fetch(
        `${endpoint}?threadId=${encodeURIComponent(threadId)}&occurrence=${encodeURIComponent(at)}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(body.error ?? "Could not read the record.");
        return;
      }
      setNote(body.record?.note ?? "");
      setAttended(body.record?.attended ?? []);
      setSuggested(body.talk?.suggested ?? []);
      setScanned(typeof body.talk?.scanned === "number" ? body.talk.scanned : null);
    } catch {
      setProblem("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(person: AttendanceSuggestion) {
    setAttended((prev) => {
      const key = person.actorId ?? person.userId ?? person.name;
      const has = prev.some((p) => (p.actorId ?? p.userId ?? p.name) === key);
      return has
        ? prev.filter((p) => (p.actorId ?? p.userId ?? p.name) !== key)
        : [...prev, person];
    });
  }

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, occurrenceAt: at, note, attended }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(body.error ?? "That did not save.");
        return;
      }
      setOpen(false);
      onSaved();
    } catch {
      setProblem("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="eac-face-tool eac-rota__record-open" onClick={() => void openPanel()}>
        Who came?
      </button>
    );
  }

  const chosen = new Set(attended.map((p) => p.actorId ?? p.userId ?? p.name));

  return (
    <div className="eac-rota__record">
      {loading ? (
        <p className="eac-rota-empty">Reading the room…</p>
      ) : (
        <>
          <p className="eac-rota__record-head">
            {suggested.length > 0
              ? "Talk saw these people. Tick the ones who were really here."
              : scanned === 0
                ? "No Talk room is linked to this gathering, so there is nothing to read."
                : "Nothing in the room's recent history falls in this window — it may simply be too long ago to tell."}
          </p>

          {suggested.length > 0 && (
            <ul className="eac-rota__people">
              {suggested.map((person) => {
                const key = person.actorId ?? person.userId ?? person.name;
                return (
                  <li key={key}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chosen.has(key)}
                        onChange={() => toggle(person)}
                      />
                      <span>{person.name}</span>
                      <em>{person.source === "call" ? "was in the call" : "typed in chat"}</em>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <label className="eac-rota__note">
            <span>A note, if it is worth one</span>
            <textarea
              className="eac-input"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was covered, what to pick up next time…"
            />
          </label>

          {problem && <p className="eac-rota__problem">{problem}</p>}

          <div className="eac-rota__record-actions">
            <button type="button" className="eac-face-tool" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="eac-face-tool eac-rota__save"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save the record"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
