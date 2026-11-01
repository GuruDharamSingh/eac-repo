"use client";

import * as React from "react";
import { NextcloudFrame } from "./NextcloudFrame";

// ============================================================================
// The group's collaborative documents as a page: the list down one side, the
// open document framed beside it (owner, 2026-10-08 — "an iframe of the
// Nextcloud, not a jump to it").
//
// Each document is a Nextcloud Text public share with edit rights, so the
// frame works for a member with no Nextcloud account: the link is the
// permission (see packages/services/src/org-documents.ts). `?doc=<id>` names
// the open one, so a document can be linked to.
// ============================================================================

export interface WorkspaceDocument {
  id: string;
  title: string;
  editUrl: string;
  createdAt: string;
  createdBy?: string | null;
}

export interface DocumentsWorkspaceProps {
  documents: WorkspaceDocument[];
  initialId?: string | null;
  /** POST { title } → { document }. Omit to hide "New document". */
  createEndpoint?: string;
  timeZone?: string;
}

export function DocumentsWorkspace({ documents: initial, initialId, createEndpoint, timeZone }: DocumentsWorkspaceProps) {
  const [documents, setDocuments] = React.useState(initial);
  const [openId, setOpenId] = React.useState<string | null>(
    () => (initialId && initial.some((d) => d.id === initialId) ? initialId : initial[0]?.id ?? null)
  );
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const open = documents.find((d) => d.id === openId) ?? null;

  const choose = (id: string) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("doc", id);
    window.history.replaceState(null, "", url);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEndpoint || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(createEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined }),
      });
      const body = (await res.json().catch(() => null)) as { document?: WorkspaceDocument; error?: string } | null;
      if (!res.ok || !body?.document) throw new Error(body?.error || "Could not create the document.");
      setDocuments((list) => [body.document as WorkspaceDocument, ...list]);
      choose(body.document.id);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the document.");
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone });

  return (
    <div className="eac-docs">
      <aside className="eac-docs-side" aria-label="The group's documents">
        {createEndpoint ? (
          <form className="eac-docs-new" onSubmit={create}>
            <label className="eac-hs-sr" htmlFor="eac-docs-title">
              New document title
            </label>
            <input
              id="eac-docs-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New document title"
              maxLength={160}
            />
            <button type="submit" className="eac-nc-btn eac-nc-btn--primary" disabled={busy}>
              {busy ? "Creating…" : "New"}
            </button>
            {error ? <p className="eac-docs-error" role="alert">{error}</p> : null}
          </form>
        ) : null}
        {documents.length === 0 ? (
          <p className="eac-hs-muted">No documents yet.</p>
        ) : (
          <ul className="eac-docs-list">
            {documents.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="eac-docs-item"
                  aria-current={d.id === openId ? "true" : undefined}
                  onClick={() => choose(d.id)}
                >
                  <span className="eac-docs-item-title">{d.title}</span>
                  <span className="eac-docs-item-meta">
                    {date(d.createdAt)}
                    {d.createdBy ? ` · ${d.createdBy}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="eac-docs-main" aria-label={open ? open.title : "Document"}>
        {open ? (
          <NextcloudFrame
            key={open.id}
            src={open.editUrl}
            title={open.title}
            height="75vh"
            note="Anyone in the group with this page can edit. Nextcloud may ask for a name the first time."
          />
        ) : (
          <p className="eac-hs-muted eac-hs-pad">Start a document, or choose one from the list.</p>
        )}
      </section>
    </div>
  );
}
