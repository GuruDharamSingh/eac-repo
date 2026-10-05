"use client";

import * as React from "react";
import type { SurfaceConnection, SurfaceConnectionsConnectors } from "./types";

// ============================================================================
// Connections — a person's own OAuth links to outside services (YouTube
// first; @elkdonis/services connections.ts, migration 192).
//
// Rendered in the profile popup's "Connections" tab and, standalone, in an
// org's admin dialogs (the Akhand Path "Admin details"), so it styles itself
// with plain `.eac-conn` classes from surface.css rather than Tailwind: not
// every host compiles Tailwind.
//
// With `onSelect`, each connected item gets a "Publish here" choice — how a
// circle picks which channel its recordings go to.
// ============================================================================

const STATUS_LABEL: Record<SurfaceConnection["status"], string> = {
  pending: "Not connected yet",
  connected: "Connected",
  error: "Needs attention",
};

export interface ConnectionsPanelProps {
  api: SurfaceConnectionsConnectors;
  /** Where Google sends the person back to after consent (an absolute URL). */
  returnTo?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Called with the list after every load. */
  onLoaded?: (connections: SurfaceConnection[]) => void;
  intro?: React.ReactNode;
}

export function ConnectionsPanel({ api, returnTo, selectedId, onSelect, onLoaded, intro }: ConnectionsPanelProps) {
  const [list, setList] = React.useState<SurfaceConnection[] | null>(null);
  const [redirectUri, setRedirectUri] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ label: "", clientId: "", clientSecret: "" });

  const load = React.useCallback(async () => {
    try {
      const r = await api.load();
      setList(r.connections);
      setRedirectUri(r.redirectUri);
      onLoaded?.(r.connections);
      if (r.connections.length === 0) setAdding(true);
    } catch {
      setError("Could not load your connections.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Back from Google: ?connection=<id>&connected=1 | &connection_error=…
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URL(window.location.href).searchParams;
    if (q.get("connected") === "1") setNotice("Connected.");
    const e = q.get("connection_error");
    if (e) setError(e);
  }, []);

  async function run(key: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    const r = await fn().catch(() => ({ ok: false as const, error: "Could not reach the server." }));
    setBusy(null);
    if (r.ok === false) {
      setError(r.error);
      return false;
    }
    if (done) setNotice(done);
    await load();
    return true;
  }

  async function submit() {
    if (editing) {
      const ok = await run(
        "save",
        () => api.update(editing, { label: form.label, clientId: form.clientId, clientSecret: form.clientSecret || undefined }),
        "Saved."
      );
      if (ok) {
        setEditing(null);
        setForm({ label: "", clientId: "", clientSecret: "" });
      }
      return;
    }
    const ok = await run("save", () => api.create({ provider: "youtube", ...form }), "Saved. Now connect it at Google.");
    if (ok) {
      setAdding(false);
      setForm({ label: "", clientId: "", clientSecret: "" });
    }
  }

  const showForm = adding || editing !== null;

  return (
    <div className="eac-conn">
      {intro}
      {notice && <p className="eac-conn__notice" role="status">{notice}</p>}
      {error && <p className="eac-conn__error" role="alert">{error}</p>}

      {list === null && !error && <p className="eac-conn__muted">Loading…</p>}

      {list && list.length > 0 && (
        <ul className="eac-conn__list">
          {list.map((c) => (
            <li key={c.id} className="eac-conn__item" data-status={c.status}>
              <div className="eac-conn__head">
                <strong>{c.label || "YouTube"}</strong>
                <span className="eac-conn__status">{STATUS_LABEL[c.status]}</span>
              </div>
              <div className="eac-conn__meta">
                {c.accountName ? (
                  <>
                    Channel:{" "}
                    {c.accountUrl ? (
                      <a href={c.accountUrl} target="_blank" rel="noreferrer">
                        {c.accountName}
                      </a>
                    ) : (
                      c.accountName
                    )}
                  </>
                ) : (
                  <>YouTube · client …{c.clientId.split("-")[0].slice(-6)}</>
                )}
              </div>
              {c.error && <div className="eac-conn__error">{c.error}</div>}
              <div className="eac-conn__actions">
                <a className="eac-btn eac-btn--primary" href={api.startHref(c.id, returnTo)}>
                  {c.status === "connected" ? "Reconnect" : "Connect at Google"}
                </a>
                {c.status === "connected" && (
                  <button
                    type="button"
                    className="eac-btn"
                    disabled={busy === `check:${c.id}`}
                    onClick={() => void run(`check:${c.id}`, () => api.check(c.id), "The connection works.")}
                  >
                    {busy === `check:${c.id}` ? "…" : "Test"}
                  </button>
                )}
                {onSelect && c.status === "connected" && (
                  <label className="eac-conn__pick">
                    <input
                      type="radio"
                      name="eac-conn-pick"
                      checked={selectedId === c.id}
                      onChange={() => onSelect(c.id)}
                    />{" "}
                    Publish here
                  </label>
                )}
                <button
                  type="button"
                  className="eac-btn eac-btn--quiet"
                  onClick={() => {
                    setAdding(false);
                    setEditing(c.id);
                    setForm({ label: c.label, clientId: c.clientId, clientSecret: "" });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="eac-btn eac-btn--quiet"
                  disabled={busy === `del:${c.id}`}
                  onClick={() => {
                    if (!window.confirm("Remove this connection? Uploads to this channel stop.")) return;
                    void run(`del:${c.id}`, () => api.remove(c.id), "Removed.").then(() => {
                      if (selectedId === c.id) onSelect?.(null);
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list && !showForm && (
        <button type="button" className="eac-btn" onClick={() => setAdding(true)}>
          Add a YouTube connection
        </button>
      )}

      {showForm && (
        <form
          className="eac-conn__form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="eac-conn__muted">
            {editing
              ? "Change the name, or paste a new client. A new client ID or secret means connecting again."
              : "From your own Google Cloud project: an OAuth client of type “Web application” with the YouTube Data API v3 enabled."}
          </p>
          <label className="eac-conn__field">
            <span>Name</span>
            <input
              value={form.label}
              placeholder="e.g. Guru Dharam's channel"
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </label>
          <label className="eac-conn__field">
            <span>Client ID</span>
            <input
              value={form.clientId}
              required={!editing}
              autoComplete="off"
              spellCheck={false}
              placeholder="…apps.googleusercontent.com"
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            />
          </label>
          <label className="eac-conn__field">
            <span>Client secret</span>
            <input
              type="password"
              value={form.clientSecret}
              required={!editing}
              autoComplete="new-password"
              spellCheck={false}
              placeholder={editing ? "Leave empty to keep the current one" : ""}
              onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
            />
            <small>Stored encrypted. It is never shown again.</small>
          </label>
          {redirectUri && (
            <div className="eac-conn__field">
              <span>Authorised redirect URI (add this to the client in Google Cloud)</span>
              <code className="eac-conn__code">{redirectUri}</code>
            </div>
          )}
          <div className="eac-conn__actions">
            <button type="submit" className="eac-btn eac-btn--primary" disabled={busy === "save"}>
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            {(editing || (list && list.length > 0)) && (
              <button
                type="button"
                className="eac-btn eac-btn--quiet"
                onClick={() => {
                  setAdding(false);
                  setEditing(null);
                  setForm({ label: "", clientId: "", clientSecret: "" });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Connectors over the JSON routes served by @elkdonis/services
 * `connectionsHandlers` (e.g. /api/center/connections), plus the network
 * host's start URL for consent.
 */
export function createConnectionsConnectors(opts: {
  /** The app's route, basePath included. */
  route: string;
  /** e.g. https://arts-collective.com/api/connections/start — handed in by the server. */
  startUrl: string;
  /** Wraps the start URL so the sign-in travels with it (the app's handoff route). */
  carry?: (url: string) => string;
}): SurfaceConnectionsConnectors {
  const send = async (method: string, body?: unknown, query = "") => {
    const res = await fetch(`${opts.route}${query}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? ({ ok: true } as const) : ({ ok: false, error: data.error ?? `Error ${res.status}` } as const);
  };
  return {
    async load() {
      const res = await fetch(opts.route, { cache: "no-store" });
      if (!res.ok) throw new Error(`connections ${res.status}`);
      return res.json();
    },
    create: (input) => send("POST", input),
    update: (id, input) => send("PATCH", { id, ...input }),
    check: (id) => send("PATCH", { id, check: true }),
    remove: (id) => send("DELETE", undefined, `?id=${encodeURIComponent(id)}`),
    startHref(id, returnTo) {
      const q = new URLSearchParams({ id });
      if (returnTo) q.set("return", returnTo);
      const url = `${opts.startUrl}?${q.toString()}`;
      return opts.carry ? opts.carry(url) : url;
    },
  };
}
