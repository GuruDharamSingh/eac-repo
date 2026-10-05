"use client";

import * as React from "react";
import {
  ConnectionsPanel,
  createConnectionsConnectors,
  type SurfaceConnection,
} from "@elkdonis/cms-ui/surface";
import { withBase } from "@/lib/base-path";
import "./admin-details.css";

/**
 * "Admin details" at the foot of the Akhand Path page: where the circle's
 * recordings are published (YouTube channel, privacy, automatic or reviewed)
 * and the viewer's own connections (client ID/secret, connect at Google).
 *
 * Shown to the circle's author and org owners/guides only (page.tsx decides;
 * /api/akhand-path/publish checks again). Consent runs on the network host:
 * `startUrl` is arts-collective's /api/connections/start, reached through
 * this app's handoff route so the sign-in travels with it.
 */

type Privacy = "private" | "unlisted" | "public";

interface Upload {
  id: string;
  fileName: string;
  folder: string;
  sourceBytes: number;
  title: string;
  status: "awaiting" | "queued" | "uploading" | "published" | "failed" | "skipped";
  youtubeUrl: string | null;
  uploadedBytes: number;
  error: string | null;
}

const UPLOAD_STATUS: Record<Upload["status"], string> = {
  awaiting: "Waiting for approval",
  queued: "Queued",
  uploading: "Uploading",
  published: "On YouTube",
  failed: "Failed",
  skipped: "Not published",
};

const mb = (n: number) => `${Math.max(1, Math.round(n / 1048576))} MB`;
type Mode = "auto" | "review";

interface Target {
  youtube: { connectionId: string | null; privacy: Privacy; mode: Mode; setAt: string | null };
  connection: {
    id: string;
    label: string;
    status: string;
    accountName: string | null;
    accountUrl: string | null;
    error: string | null;
    ownerName: string | null;
  } | null;
}

export function AdminDetails({ startUrl }: { startUrl: string }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [target, setTarget] = React.useState<Target | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [mine, setMine] = React.useState<SurfaceConnection[]>([]);
  const [uploads, setUploads] = React.useState<Upload[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const api = React.useMemo(
    () =>
      createConnectionsConnectors({
        route: withBase("/api/center/connections"),
        startUrl,
        carry: (url) => withBase(`/api/auth/handoff?${new URLSearchParams({ to: url }).toString()}`),
      }),
    [startUrl]
  );

  const load = React.useCallback(async () => {
    const res = await fetch(withBase("/api/akhand-path/publish"), { cache: "no-store" });
    if (res.ok) setTarget(await res.json());
    else setError("Could not load the publishing settings.");
    const u = await fetch(withBase("/api/akhand-path/uploads"), { cache: "no-store" });
    if (u.ok) setUploads((await u.json()).uploads);
  }, []);

  async function act(id: string, action: "approve" | "retry" | "skip" | "restore") {
    setBusy(id);
    setError(null);
    const res = await fetch(withBase("/api/akhand-path/uploads"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Could not do that.");
    setUploads(data.uploads);
  }

  // Coming back from Google lands here with ?connection=…: reopen the dialog.
  React.useEffect(() => {
    const q = new URL(window.location.href).searchParams;
    if (q.get("connection")) {
      ref.current?.showModal();
      void load();
    }
  }, [load]);

  async function save(input: Partial<{ connectionId: string | null; privacy: Privacy; mode: Mode }>) {
    setError(null);
    setSaved(null);
    const res = await fetch(withBase("/api/akhand-path/publish"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Could not save that.");
    setTarget(data);
    setSaved("Saved.");
  }

  // Back to this page, clean of any earlier outcome parameters.
  const returnTo = React.useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const url = new URL(window.location.href);
    for (const k of ["connection", "connected", "connection_error"]) url.searchParams.delete(k);
    return url.toString();
  }, []);

  const y = target?.youtube;
  const bound = target?.connection;
  const boundIsMine = bound ? mine.some((c) => c.id === bound.id) : false;

  return (
    <>
      <div className="paath-admin">
        <button
          type="button"
          className="btn"
          onClick={() => {
            ref.current?.showModal();
            void load();
          }}
        >
          Admin details
        </button>
      </div>

      <dialog ref={ref} className="paath-admin-dialog" aria-labelledby="paath-admin-title">
        <header className="paath-admin-dialog__head">
          <h2 id="paath-admin-title">Admin details</h2>
          <button type="button" className="btn btn--small" onClick={() => ref.current?.close()} aria-label="Close">
            Close
          </button>
        </header>

        <section className="paath-admin-dialog__section">
          <h3>Recordings to YouTube</h3>
          <p className="paath-admin-dialog__muted">
            Where the recordings of this reading go. New recordings appear below within a few minutes of being
            filed; with “Upload it automatically” they go straight to the channel, otherwise they wait for approval
            here. Until the Google project passes YouTube&rsquo;s audit, YouTube keeps every upload private.
          </p>
          {error && <p className="paath-admin-dialog__error" role="alert">{error}</p>}
          {saved && <p className="paath-admin-dialog__muted" role="status">{saved}</p>}
          {!target && !error && <p className="paath-admin-dialog__muted">Loading…</p>}
          {target && y && (
            <div className="paath-admin-dialog__grid">
              <div>
                <span className="paath-admin-dialog__label">Channel</span>
                {bound ? (
                  <p>
                    {bound.accountUrl ? (
                      <a href={bound.accountUrl} target="_blank" rel="noreferrer">
                        {bound.accountName ?? bound.label}
                      </a>
                    ) : (
                      bound.accountName ?? bound.label ?? "YouTube"
                    )}
                    {bound.ownerName && !boundIsMine ? ` · connected by ${bound.ownerName}` : ""}
                    {bound.status !== "connected" && ` · ${bound.error ?? "needs reconnecting"}`}
                    {" "}
                    <button type="button" className="btn btn--small" onClick={() => void save({ connectionId: null })}>
                      Clear
                    </button>
                  </p>
                ) : (
                  <p className="paath-admin-dialog__muted">None. Choose “Publish here” on a connected channel below.</p>
                )}
              </div>
              <label>
                <span className="paath-admin-dialog__label">Visibility on YouTube</span>
                <select value={y.privacy} onChange={(e) => void save({ privacy: e.target.value as Privacy })}>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted (needs the API audit)</option>
                  <option value="public">Public (needs the API audit)</option>
                </select>
              </label>
              <label>
                <span className="paath-admin-dialog__label">When a recording is ready</span>
                <select value={y.mode} onChange={(e) => void save({ mode: e.target.value as Mode })}>
                  <option value="review">Wait for someone to approve it</option>
                  <option value="auto">Upload it automatically</option>
                </select>
              </label>
            </div>
          )}
        </section>

        <section className="paath-admin-dialog__section">
          <h3>Recordings</h3>
          {uploads === null ? (
            <p className="paath-admin-dialog__muted">Loading…</p>
          ) : uploads.length === 0 ? (
            <p className="paath-admin-dialog__muted">
              None yet. Once a channel is chosen, recordings filed in the day folders show here.
            </p>
          ) : (
            <ul className="paath-uploads">
              {uploads.map((u) => (
                <li key={u.id} className="paath-uploads__item" data-status={u.status}>
                  <div className="paath-uploads__head">
                    <strong>{u.folder}</strong>
                    <span className="paath-uploads__status">
                      {UPLOAD_STATUS[u.status]}
                      {u.status === "uploading" && u.sourceBytes > 0
                        ? ` · ${Math.floor((u.uploadedBytes / u.sourceBytes) * 100)}%`
                        : ""}
                    </span>
                  </div>
                  <div className="paath-admin-dialog__muted">
                    {u.fileName} · {mb(u.sourceBytes)}
                  </div>
                  {u.error && <div className="paath-admin-dialog__error">{u.error}</div>}
                  <div className="paath-uploads__actions">
                    {u.youtubeUrl && (
                      <a href={u.youtubeUrl} target="_blank" rel="noreferrer">
                        Open on YouTube
                      </a>
                    )}
                    {u.status === "awaiting" && (
                      <button type="button" className="btn btn--small" disabled={busy === u.id} onClick={() => void act(u.id, "approve")}>
                        Approve and upload
                      </button>
                    )}
                    {u.status === "failed" && (
                      <button type="button" className="btn btn--small" disabled={busy === u.id} onClick={() => void act(u.id, "retry")}>
                        Retry
                      </button>
                    )}
                    {(u.status === "awaiting" || u.status === "failed") && (
                      <button type="button" className="btn btn--small" disabled={busy === u.id} onClick={() => void act(u.id, "skip")}>
                        Don&rsquo;t publish
                      </button>
                    )}
                    {u.status === "skipped" && (
                      <button type="button" className="btn btn--small" disabled={busy === u.id} onClick={() => void act(u.id, "restore")}>
                        Undo
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {uploads && uploads.length > 0 && (
            <p>
              <button type="button" className="btn btn--small" onClick={() => void load()}>
                Refresh
              </button>
            </p>
          )}
        </section>

        <section className="paath-admin-dialog__section">
          <h3>Your connections</h3>
          <ConnectionsPanel
            api={api}
            returnTo={returnTo}
            selectedId={y?.connectionId ?? null}
            onSelect={(id) => void save({ connectionId: id })}
            onLoaded={setMine}
          />
        </section>
      </dialog>
    </>
  );
}
