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
//
// 2026-10-29: Facebook & Instagram and Threads use the collective's own apps,
// so they need no client form: one click creates the row and sends the
// person to Meta's consent screen. The item then lists the Pages found.
//
// 2026-11-01: YouTube does the same when the server has the collective's
// Google client (`youtubeCollective`); the paste-a-client form stays behind
// "Use your own Google client".
// ============================================================================

const PROVIDER_NAME: Record<SurfaceConnection["provider"], string> = {
  youtube: "YouTube",
  meta: "Facebook & Instagram",
  threads: "Threads",
  instagram: "Instagram",
};
const CONSENT_AT: Record<SurfaceConnection["provider"], string> = {
  youtube: "Google",
  meta: "Facebook",
  threads: "Threads",
  instagram: "Instagram",
};

const STATUS_LABEL: Record<SurfaceConnection["status"], string> = {
  pending: "Not connected yet",
  connected: "Connected",
  error: "Needs attention",
};

/** What each audit row means, in the person's words (connection_events, 2026-11-01). */
const EVENT_LABEL: Record<string, string> = {
  created: "connection added",
  connected: "connected",
  connect_failed: "connection failed",
  token_used: "used to post or read",
  tested: "tested",
  page_attached: "Page attached",
  channel_set: "set as an organisation's channel",
  channel_cleared: "no longer an organisation's channel",
  removed: "removed",
  revoke_attempted: "access revoked at the platform",
  refreshed: "token renewed",
  refresh_failed: "renewal failed, reconnect needed",
  expiry_warned: "reconnect reminder sent",
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
  const [youtubeCollective, setYoutubeCollective] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pageRef, setPageRef] = React.useState<Record<string, string>>({});
  const [orgs, setOrgs] = React.useState<Array<{ orgId: string; name: string }>>([]);
  const [channels, setChannels] = React.useState<Array<{ orgId: string; provider: string; externalId: string }>>([]);
  const [events, setEvents] = React.useState<Array<{ id: number; connectionId: string; provider: string; event: string; detail: Record<string, unknown>; at: string }>>([]);

  /** "Channel for <org>" picker on an account the person's connection holds (2026-11-01). */
  function channelPicker(c: SurfaceConnection, externalId: string, provider: string) {
    if (!api.setChannel || orgs.length === 0 || !externalId) return null;
    const current = channels.find((ch) => ch.provider === provider && ch.externalId === externalId)?.orgId ?? "";
    return (
      <label className="eac-conn__channel">
        <span>Channel for</span>
        <select
          value={current}
          disabled={busy === `chan:${c.id}:${externalId}`}
          onChange={(e) => {
            const next = e.target.value;
            void run(`chan:${c.id}:${externalId}`, async () => {
              if (current) {
                const off = await api.setChannel!(c.id, { orgId: current, externalId, on: false });
                if (off.ok === false) return off;
              }
              if (next) return api.setChannel!(c.id, { orgId: next, externalId, on: true });
              return { ok: true as const };
            }, next ? "Set as the organisation's channel." : "No longer an organisation's channel.").then(() => void load());
          }}
        >
          <option value="">— just me —</option>
          {orgs.map((o) => (
            <option key={o.orgId} value={o.orgId}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
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
      setYoutubeCollective(Boolean(r.youtubeCollective));
      setOrgs(r.orgs ?? []);
      setChannels(r.channels ?? []);
      setEvents(r.events ?? []);
      onLoaded?.(r.connections);
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

  /** The collective's apps (Meta, Threads, Instagram; YouTube when set): create the row, then go straight to consent. */
  async function connectApp(provider: "youtube" | "meta" | "threads" | "instagram") {
    setBusy(`add:${provider}`);
    setError(null);
    setNotice(null);
    const before = new Set((list ?? []).map((c) => c.id));
    const r = await api.create({ provider }).catch(() => ({ ok: false as const, error: "Could not reach the server." }));
    if (r.ok === false) {
      setBusy(null);
      setError(r.error);
      return;
    }
    const after = await api.load().catch(() => null);
    setBusy(null);
    const created = after?.connections.find((c) => !before.has(c.id) && c.provider === provider);
    if (after) setList(after.connections);
    if (created) window.location.href = api.startHref(created.id, returnTo);
  }

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
                <strong>{c.label || PROVIDER_NAME[c.provider]}</strong>
                <span className="eac-conn__status">{STATUS_LABEL[c.status]}</span>
              </div>
              <div className="eac-conn__meta">
                {c.accountName ? (
                  <>
                    {c.provider === "youtube" ? "Channel" : c.provider === "meta" ? "Facebook account" : c.provider === "instagram" ? "Account" : "Profile"}:{" "}
                    {c.accountUrl ? (
                      <a href={c.accountUrl} target="_blank" rel="noreferrer">
                        {c.accountName}
                      </a>
                    ) : (
                      c.accountName
                    )}
                  </>
                ) : c.provider === "youtube" && !c.collective ? (
                  <>YouTube · client …{c.clientId.split("-")[0].slice(-6)}</>
                ) : (
                  <>{PROVIDER_NAME[c.provider]} · not connected yet</>
                )}
              </div>
              {c.provider === "meta" && c.targets.length > 0 && (
                <ul className="eac-conn__targets">
                  {c.targets.map((t) => (
                    <li key={t.id}>
                      {t.name}
                      {t.instagramUsername ? ` · Instagram @${t.instagramUsername}` : ""}
                      {!t.canPublish ? " · your role cannot post" : ""}
                      {channelPicker(c, t.id, "meta")}
                    </li>
                  ))}
                </ul>
              )}
              {c.provider !== "meta" && c.status === "connected" && c.accountId && (
                <div className="eac-conn__targets">{channelPicker(c, c.accountId, c.provider)}</div>
              )}
              {c.error && <div className="eac-conn__error">{c.error}</div>}
              {c.provider === "meta" && c.status === "connected" && api.addPage && (
                <form
                  className="eac-conn__addpage"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const ref = pageRef[c.id] ?? "";
                    if (!ref.trim()) return;
                    void run(`page:${c.id}`, () => api.addPage!(c.id, ref), "Page attached.").then(() => setPageRef((s) => ({ ...s, [c.id]: "" })));
                  }}
                >
                  <input
                    type="text"
                    value={pageRef[c.id] ?? ""}
                    placeholder={c.targets.length ? "Another Page: id or facebook.com address" : "Page missing? Its id or facebook.com address"}
                    onChange={(e) => setPageRef((s) => ({ ...s, [c.id]: e.target.value }))}
                  />
                  <button type="submit" className="eac-btn" disabled={busy === `page:${c.id}`}>
                    {busy === `page:${c.id}` ? "…" : "Attach Page"}
                  </button>
                </form>
              )}
              <div className="eac-conn__actions">
                <a className="eac-btn eac-btn--primary" href={api.startHref(c.id, returnTo)}>
                  {c.status === "connected" ? "Reconnect" : `Connect at ${CONSENT_AT[c.provider]}`}
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
                {c.provider === "youtube" && !c.collective && (
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
                )}
                <button
                  type="button"
                  className="eac-btn eac-btn--quiet"
                  disabled={busy === `del:${c.id}`}
                  onClick={() => {
                    if (!window.confirm(c.provider === "youtube" ? "Remove this connection? Uploads to this channel stop." : "Remove this connection? Posting there stops, and the stored token is deleted.")) return;
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

      {events.length > 0 && (
        <details className="eac-conn__log">
          <summary>Recent activity ({events.length})</summary>
          <ul>
            {events.map((e) => (
              <li key={e.id}>
                <time dateTime={e.at}>{new Date(e.at).toLocaleString("en-CA", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</time>
                {" · "}
                {PROVIDER_NAME[e.provider as keyof typeof PROVIDER_NAME] ?? e.provider}
                {" · "}
                {EVENT_LABEL[e.event] ?? e.event}
                {e.detail && typeof e.detail.by === "string" ? ` (${e.detail.by})` : ""}
                {e.detail && typeof e.detail.name === "string" ? `: ${e.detail.name}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {list && !showForm && (
        <div className="eac-conn__actions">
          <button type="button" className="eac-btn" disabled={busy === "add:meta"} onClick={() => void connectApp("meta")}>
            {busy === "add:meta" ? "…" : "Connect Facebook & Instagram"}
          </button>
          <button type="button" className="eac-btn" disabled={busy === "add:instagram"} onClick={() => void connectApp("instagram")}>
            {busy === "add:instagram" ? "…" : "Connect Instagram (no Page)"}
          </button>
          <button type="button" className="eac-btn" disabled={busy === "add:threads"} onClick={() => void connectApp("threads")}>
            {busy === "add:threads" ? "…" : "Connect Threads"}
          </button>
          {youtubeCollective ? (
            <>
              <button type="button" className="eac-btn" disabled={busy === "add:youtube"} onClick={() => void connectApp("youtube")}>
                {busy === "add:youtube" ? "…" : "Connect YouTube"}
              </button>
              <button type="button" className="eac-btn eac-btn--quiet" onClick={() => setAdding(true)}>
                Use your own Google client
              </button>
            </>
          ) : (
            <button type="button" className="eac-btn" onClick={() => setAdding(true)}>
              Add a YouTube connection
            </button>
          )}
        </div>
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
    addPage: (id, page) => send("PATCH", { id, addPage: page }),
    setChannel: (id, input) => send("PATCH", { id, channel: input }),
    startHref(id, returnTo) {
      const q = new URLSearchParams({ id });
      if (returnTo) q.set("return", returnTo);
      const url = `${opts.startUrl}?${q.toString()}`;
      return opts.carry ? opts.carry(url) : url;
    },
  };
}
