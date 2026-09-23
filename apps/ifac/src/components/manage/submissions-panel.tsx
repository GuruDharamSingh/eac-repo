"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * What members have sent in, and whether anything waits at all.
 *
 * The switch is the honest part of this screen: IFAC ships with the queue OFF
 * — a member posts and it is up — so most of the time this page says "nothing
 * waiting", and that is the correct resting state rather than a sign it is
 * broken. Turning the switch on is what makes it a queue.
 */
export interface Submission {
  id: string;
  title: string;
  kind: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  authorName: string | null;
}

export interface ReviewedSubmission extends Submission {
  status: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

export interface PendingPanel {
  userId: string;
  orgId: string;
  key: string;
  authorName: string | null;
  authorAvatar: string | null;
  createdAt: string;
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

export function SubmissionsPanel({
  initialPending,
  recent,
  review,
  initialPendingPanels,
  storePanels,
}: {
  initialPending: Submission[];
  recent: ReviewedSubmission[];
  review: boolean;
  initialPendingPanels: PendingPanel[];
  storePanels: boolean;
}) {
  const [pending, setPending] = useState(initialPending);
  const [held, setHeld] = useState(review);
  const [pendingPanels, setPendingPanels] = useState(initialPendingPanels);
  const [panelsOn, setPanelsOn] = useState(storePanels);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function post(body: unknown) {
    const res = await fetch("/api/manage/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "That didn't work.");
      return null;
    }
    return data;
  }

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    const data = await post({ threadId: id, decision });
    setBusy(null);
    if (!data) return;
    setPending((list) => list.filter((s) => s.id !== id));
    toast.success(decision === "approve" ? "Published." : "Turned down — it's archived, not deleted.");
    startTransition(() => {});
  }

  async function toggle(on: boolean) {
    setBusy("switch");
    const data = await post({ review: on });
    setBusy(null);
    if (!data) return;
    setHeld(Boolean(data.review));
    toast.success(on ? "Members' posts will wait for a guide." : "Members' posts go straight up.");
  }

  async function togglePanels(on: boolean) {
    setBusy("panels-switch");
    const data = await post({ storePanels: on });
    setBusy(null);
    if (!data) return;
    setPanelsOn(Boolean(data.storePanels));
    toast.success(on ? "Members can now submit a designed store panel." : "Store panels are off — nobody can submit one.");
  }

  async function decidePanel(userId: string, key: string, decision: "approve" | "reject") {
    const id = `${userId}:${key}`;
    setBusy(id);
    const data = await post({ panelUserId: userId, panelKey: key, panelDecision: decision });
    setBusy(null);
    if (!data) return;
    setPendingPanels((list) => list.filter((p) => !(p.userId === userId && p.key === key)));
    toast.success(decision === "approve" ? "Panel published." : "Turned down — it's archived, not deleted.");
    startTransition(() => {});
  }

  return (
    <div className="manage-submissions">
      <section className="admin-panel">
        <h2>Before it goes up</h2>
        <p className="body-copy">
          Owners and guides moderate everything the collective publishes — any piece can be taken
          down from its own page at any time. This switch decides what happens <em>first</em>.
        </p>
        <label className="manage-switch">
          <input
            type="checkbox"
            checked={held}
            disabled={busy === "switch"}
            onChange={(e) => void toggle(e.currentTarget.checked)}
          />
          <span>
            <strong>Hold members&rsquo; posts for a look</strong>
            <em>
              {held
                ? "A member's post waits here until an owner or guide says yes."
                : "Off — a member posts and it appears at once. Owners and guides are never held."}
            </em>
          </span>
        </label>
      </section>

      <section className="admin-panel">
        <h2>Members&rsquo; store panels</h2>
        <p className="body-copy">
          A designed panel replaces the plain store listing on a member&rsquo;s own artist page — their
          layout, their choice of gallery. Off by default: nobody can submit one until this is on.
        </p>
        <label className="manage-switch">
          <input
            type="checkbox"
            checked={panelsOn}
            disabled={busy === "panels-switch"}
            onChange={(e) => void togglePanels(e.currentTarget.checked)}
          />
          <span>
            <strong>Host members&rsquo; designed store panels</strong>
            <em>
              {panelsOn
                ? "Members can design a panel and submit it here for a look."
                : "Off — members can still design one, but cannot submit it."}
            </em>
          </span>
        </label>
        {pendingPanels.length > 0 && (
          <ul className="manage-sub-list" style={{ marginTop: "1rem" }}>
            {pendingPanels.map((p) => {
              const id = `${p.userId}:${p.key}`;
              return (
                <li key={id} className="manage-sub">
                  {p.authorAvatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="manage-sub__cover" src={p.authorAvatar} alt="" />
                  )}
                  <div className="manage-sub__body">
                    <p className="manage-sub__meta">
                      {p.key} · {p.authorName ?? "Someone"} · {when(p.createdAt)}
                    </p>
                    <h3 className="manage-sub__title">Store panel</h3>
                  </div>
                  <div className="manage-sub__actions">
                    <button
                      type="button"
                      className="hub-btn"
                      disabled={busy === id}
                      onClick={() => void decidePanel(p.userId, p.key, "approve")}
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      className="hub-btn hub-btn--quiet"
                      disabled={busy === id}
                      onClick={() => void decidePanel(p.userId, p.key, "reject")}
                    >
                      Turn down
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="admin-panel">
        <h2>Waiting {pending.length > 0 && <span className="manage-count">{pending.length}</span>}</h2>
        {pending.length === 0 ? (
          <p className="body-copy">Nothing is waiting.</p>
        ) : (
          <ul className="manage-sub-list">
            {pending.map((s) => (
              <li key={s.id} className="manage-sub">
                {s.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="manage-sub__cover" src={s.coverImageUrl} alt="" />
                )}
                <div className="manage-sub__body">
                  <p className="manage-sub__meta">
                    {s.kind} · {s.authorName ?? "Someone"} · {when(s.createdAt)}
                  </p>
                  <h3 className="manage-sub__title">{s.title}</h3>
                  {s.excerpt && <p className="manage-sub__excerpt">{s.excerpt}</p>}
                </div>
                <div className="manage-sub__actions">
                  <button
                    type="button"
                    className="hub-btn"
                    disabled={busy === s.id}
                    onClick={() => void decide(s.id, "approve")}
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    className="hub-btn hub-btn--quiet"
                    disabled={busy === s.id}
                    onClick={() => void decide(s.id, "reject")}
                  >
                    Turn down
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="admin-panel">
          <h2>Lately</h2>
          <ul className="manage-sub-list manage-sub-list--quiet">
            {recent.map((s) => (
              <li key={s.id} className="manage-sub">
                <div className="manage-sub__body">
                  <p className="manage-sub__meta">
                    {s.status === "published" ? "Published" : "Turned down"} · {when(s.reviewedAt)}
                    {s.reviewedByName ? ` · by ${s.reviewedByName}` : ""}
                  </p>
                  <h3 className="manage-sub__title">{s.title}</h3>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
