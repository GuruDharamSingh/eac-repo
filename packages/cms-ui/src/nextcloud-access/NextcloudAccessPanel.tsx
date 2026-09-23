"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * An org owner's view of their people on Nextcloud — any org site mounts it
 * over the route from `createNextcloudAccessRoutes` (@elkdonis/services).
 *
 * The shape below mirrors services' NextcloudAccessOverview; it is restated
 * rather than imported because cms-ui does not depend on services.
 *
 * Plain CSS (nextcloud-access.css) with custom-property fallbacks: hosts carry
 * their own stylesheets, and Tailwind utilities from a package render unstyled
 * in any host that didn't @source it.
 */

type Status = "pending" | "running" | "done" | "failed";

interface SyncRequest {
  id: string;
  reason: string;
  status: Status;
  requestedAt: string;
  finishedAt: string | null;
  requestedBy: string | null;
  detail: string | null;
}

interface Member {
  userId: string;
  displayName: string;
  email: string | null;
  role: "owner" | "guide" | "member";
  nextcloudUserId: string | null;
}

interface Overview {
  orgName: string;
  folderPath: string;
  hasCircle: boolean;
  members: Member[];
  viewerCount: number;
  pending: boolean;
  recent: SyncRequest[];
  lastDoneAt: string | null;
}

export interface NextcloudAccessPanelProps {
  /** The host's route, e.g. "/api/manage/nextcloud-access". */
  endpoint: string;
  /** Where members sign in to Nextcloud, e.g. "https://cloud.elkdonis-arts.org". */
  nextcloudUrl: string;
}

const ROLE_LABEL: Record<Member["role"], string> = { owner: "Owner", guide: "Guide", member: "Member" };
const STATUS_LABEL: Record<Status, string> = {
  pending: "Waiting",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NextcloudAccessPanel({ endpoint, nextcloudUrl }: NextcloudAccessPanelProps) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { credentials: "include", cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't load this.");
        return;
      }
      setError(null);
      setData(body as Overview);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  // While a sync is waiting or running, look again every 30s so the owner
  // sees it finish without reloading.
  const inFlight = Boolean(data?.recent.some((r) => r.status === "pending" || r.status === "running"));
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [inFlight, load]);

  async function syncNow() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(endpoint, { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(body.error ?? "That didn't work.");
      } else {
        setNote(
          body.alreadyPending
            ? "A sync is already waiting — it will run within about 10 minutes."
            : "Sync requested. It will run within about 10 minutes."
        );
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <section className="eac-ncaccess">
        <p className="eac-ncaccess__error" role="alert">{error}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="eac-ncaccess" aria-busy="true">
        <p className="eac-ncaccess__muted">Loading…</p>
      </section>
    );
  }

  const linked = data.members.filter((m) => m.nextcloudUserId).length;
  const unlinked = data.members.length - linked;

  return (
    <section className="eac-ncaccess" aria-labelledby="eac-ncaccess-title">
      <header className="eac-ncaccess__head">
        <div>
          <p className="eac-ncaccess__kicker">Cloud storage</p>
          <h2 id="eac-ncaccess-title" className="eac-ncaccess__title">Nextcloud access</h2>
          <p className="eac-ncaccess__lede">
            Owners, guides and members get {data.orgName}&rsquo;s shared folder
            (<code>{data.folderPath}</code>), its circle, and a private folder of their own.
            Followers don&rsquo;t — make someone a member first.
          </p>
        </div>
        <div className="eac-ncaccess__action">
          <button type="button" className="eac-ncaccess__button" onClick={syncNow} disabled={busy || data.pending}>
            {data.pending ? "Sync waiting…" : busy ? "Requesting…" : "Sync now"}
          </button>
          <p className="eac-ncaccess__muted">Last sync: {when(data.lastDoneAt)}</p>
        </div>
      </header>

      {note && <p className="eac-ncaccess__note" role="status">{note}</p>}

      <p className="eac-ncaccess__summary">
        <strong>{linked}</strong> of {data.members.length} linked to Nextcloud
        {data.viewerCount > 0 && <> · {data.viewerCount} follower{data.viewerCount === 1 ? "" : "s"} (no access)</>}
      </p>

      {unlinked > 0 && (
        <p className="eac-ncaccess__howto">
          To link, a person opens{" "}
          <a href={nextcloudUrl} target="_blank" rel="noreferrer">{nextcloudUrl.replace(/^https?:\/\//, "")}</a>{" "}
          and chooses <strong>Sign in with Elkdonis</strong>, once. The next sync (within about 10 minutes)
          gives them the folder and circle.
        </p>
      )}

      <table className="eac-ncaccess__table">
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Role</th>
            <th scope="col">Nextcloud</th>
          </tr>
        </thead>
        <tbody>
          {data.members.map((m) => (
            <tr key={m.userId}>
              <td>
                <span className="eac-ncaccess__name">{m.displayName}</span>
                {m.email && <span className="eac-ncaccess__muted"> {m.email}</span>}
              </td>
              <td>{ROLE_LABEL[m.role]}</td>
              <td>
                {m.nextcloudUserId ? (
                  <span className="eac-ncaccess__state is-linked">Linked</span>
                ) : (
                  <span className="eac-ncaccess__state is-unlinked">Not linked yet</span>
                )}
              </td>
            </tr>
          ))}
          {data.members.length === 0 && (
            <tr>
              <td colSpan={3} className="eac-ncaccess__muted">No members yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      {data.recent.length > 0 && (
        <details className="eac-ncaccess__history">
          <summary>Recent syncs</summary>
          <ul>
            {data.recent.map((r) => (
              <li key={r.id}>
                <span className={`eac-ncaccess__state is-${r.status}`}>{STATUS_LABEL[r.status]}</span>{" "}
                {when(r.requestedAt)}
                {r.requestedBy && <> · asked by {r.requestedBy}</>}
                {r.status === "failed" && r.detail && <p className="eac-ncaccess__muted">{r.detail}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
