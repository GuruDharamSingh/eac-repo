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
 * An organiser gets the full picker (anyone, either slot). A plain member
 * gets a narrower, self-serve door onto the SAME data: "I'll host this one" /
 * "I'll co-host" when a slot is open, "Step down" when it is their own name
 * in it, and just the name — no control — when it is somebody else's. The
 * backend enforces the same split (a member's write can only ever be about
 * themselves), so this is a convenience, not the permission.
 */

export interface PlanAheadPerson {
  userId: string | null;
  displayName: string | null;
  note: string | null;
}

export interface PlanAheadOccurrence {
  at: string;
  isPast?: boolean;
  host: PlanAheadPerson | null;
  /** A second pair of hands on the same occurrence. Same self-serve rules. */
  coHost?: PlanAheadPerson | null;
  hasRecord: boolean;
  /** What this one is covering — the reading, the piece, the topic. */
  plan?: string | null;
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
  /** So the surface can tell "is this me" without a second round trip. */
  viewerId?: string | null;
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

  /**
   * What this week is covering. An organiser may write any week; the week's
   * own host may write theirs — saying what you are bringing should not need
   * an owner. The server makes the same check; this only decides what to show.
   */
  async function savePlan(at: string, plan: string) {
    setSavingAt(`${at}:plan`);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId, occurrenceAt: at, plan }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not save what it is covering.");
        return;
      }
      await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSavingAt(null);
    }
  }

  async function assign(at: string, userId: string | null, role: string = "host") {
    // Keyed by occurrence AND role, so taking yourself off co-host does not
    // grey out the host control for the same row.
    setSavingAt(`${at}:${role}`);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, occurrenceAt: at, role, userId }),
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

  // The SERVER decides who may plan (the route checks the viewer's role on
  // every write, too). This used to require the opener's `canPlan` prop AS
  // WELL, and the page-layout banner opens this without one — so an owner who
  // opened Plan ahead from the banner got a read-only list of names and no way
  // to put anyone down. The prop is now only the fallback before data loads.
  const editable = data ? Boolean(data.canPlan) : canPlan;

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
              : "Who is running each one. Open a week to take it yourself."}
          </p>
          <ol className="eac-rota">
            {data.occurrences.map((occurrence) => {
              const when = new Date(occurrence.at);
              const open = !occurrence.isPast;
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

                  <div className="eac-rota__roles">
                    <RoleSlot
                      label="Host"
                      role="host"
                      person={occurrence.host ?? null}
                      occurrenceAt={occurrence.at}
                      open={open}
                      editable={editable}
                      viewerId={data.viewerId ?? null}
                      candidates={data.candidates}
                      savingAt={savingAt}
                      onAssign={assign}
                    />
                    {/* Co-host is always offered, whether or not this rota
                        actively uses it — an empty slot nobody has ever
                        touched is just "Nobody yet", same as host. */}
                    <RoleSlot
                      label="Co-host"
                      role="co-host"
                      person={occurrence.coHost ?? null}
                      occurrenceAt={occurrence.at}
                      open={open}
                      editable={editable}
                      viewerId={data.viewerId ?? null}
                      candidates={data.candidates}
                      savingAt={savingAt}
                      onAssign={assign}
                    />
                  </div>

                  <PlanLine
                    at={occurrence.at}
                    plan={occurrence.plan ?? null}
                    saving={savingAt === `${occurrence.at}:plan`}
                    canWrite={
                      editable ||
                      Boolean(
                        data.viewerId &&
                          (occurrence.host?.userId === data.viewerId ||
                            occurrence.coHost?.userId === data.viewerId)
                      )
                    }
                    onSave={savePlan}
                  />

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
 * One role on one occurrence: the organiser's picker, or a member's
 * self-serve door onto the same row.
 */
/**
 * "Covering: …" — what a given week is about.
 *
 * Reads as a line of text until someone who may change it clicks, which is
 * the right weight for a field that is usually a book chapter or a title. A
 * week with nothing said shows the invitation only to those who can answer it.
 */
function PlanLine({
  at,
  plan,
  saving,
  canWrite,
  onSave,
}: {
  at: string;
  plan: string | null;
  saving: boolean;
  canWrite: boolean;
  onSave: (at: string, plan: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(plan ?? "");

  React.useEffect(() => {
    setDraft(plan ?? "");
  }, [plan]);

  if (!canWrite && !plan) return null;

  if (!editing) {
    return (
      <p className="eac-rota__plan">
        {plan ? (
          <>
            <span className="eac-rota__plan-label">Covering</span> {plan}
          </>
        ) : (
          <span className="eac-rota__plan-empty">Nothing said yet</span>
        )}
        {canWrite && (
          <button type="button" className="eac-rota__plan-edit" onClick={() => setEditing(true)}>
            {plan ? "Change" : "Say what it covers"}
          </button>
        )}
      </p>
    );
  }

  const commit = async () => {
    setEditing(false);
    if (draft.trim() !== (plan ?? "").trim()) await onSave(at, draft);
  };

  return (
    <p className="eac-rota__plan">
      <label className="eac-rota__plan-label" htmlFor={`plan-${at}`}>
        Covering
      </label>
      <input
        id={`plan-${at}`}
        className="eac-rota__plan-input"
        value={draft}
        autoFocus
        disabled={saving}
        placeholder="A reading, a piece, a topic…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            setDraft(plan ?? "");
            setEditing(false);
          }
        }}
        onBlur={() => void commit()}
      />
    </p>
  );
}

function RoleSlot({
  label,
  role,
  person,
  occurrenceAt,
  open,
  editable,
  viewerId,
  candidates,
  savingAt,
  onAssign,
}: {
  label: string;
  role: string;
  person: PlanAheadPerson | null;
  occurrenceAt: string;
  open: boolean;
  editable: boolean;
  viewerId: string | null;
  candidates: PlanAheadCandidate[];
  savingAt: string | null;
  onAssign: (at: string, userId: string | null, role: string) => Promise<void>;
}) {
  const busy = savingAt === `${occurrenceAt}:${role}`;

  if (editable && open) {
    return (
      <label className="eac-rota__pick">
        <span className="eac-rota__pick-label">{label}</span>
        <select
          className="eac-input"
          value={person?.userId ?? ""}
          disabled={busy}
          onChange={(e) => void onAssign(occurrenceAt, e.target.value || null, role)}
        >
          {/* "" is the real, meaningful option here — nobody has this week —
              so it carries a word rather than being an empty row. */}
          <option value="">Nobody yet</option>
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.displayName}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const isMe = Boolean(viewerId) && person?.userId === viewerId;

  if (!editable && open && (isMe || !person)) {
    // A member's self-serve door: take an open slot, or step back off their
    // own. Never a way to touch somebody else's name.
    return (
      <div className="eac-rota__pick">
        <span className="eac-rota__pick-label">{label}</span>
        {isMe ? (
          <button
            type="button"
            className="eac-face-tool eac-rota__self"
            disabled={busy}
            onClick={() => void onAssign(occurrenceAt, null, role)}
          >
            {busy ? "…" : "Step down"}
          </button>
        ) : (
          <button
            type="button"
            className="eac-face-tool eac-rota__self"
            disabled={busy}
            onClick={() => void onAssign(occurrenceAt, viewerId, role)}
          >
            {busy ? "…" : `I'll ${role === "host" ? "host this one" : "co-host"}`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="eac-rota__pick">
      <span className="eac-rota__pick-label">{label}</span>
      <span className={"eac-rota__host" + (person?.displayName ? "" : " eac-rota__host--none")}>
        {person?.displayName ?? "Nobody yet"}
      </span>
    </div>
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
