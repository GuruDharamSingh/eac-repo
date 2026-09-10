"use client";

import { useState } from "react";
import type { LivingDocument } from "@/lib/hub-data";
import { HubCard } from "./HubCard";
import { formatDay } from "./format";

/**
 * Living documents.
 *
 * The face shows the most recent document by title and date; the modal is both
 * the list of the group's other documents and the way to start one.
 *
 * The links go to Nextcloud, opened in a new tab rather than iframed. An
 * iframe was the obvious move and is wrong here: Nextcloud sends
 * `X-Frame-Options: SAMEORIGIN`, so an embedded editor renders as a blank box
 * with no error a member could act on.
 */
export function DocumentsCard({
  initialDocuments,
}: {
  initialDocuments: LivingDocument[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = documents[0];

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the document a title.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create it.");
        return;
      }
      setDocuments((current) => [data.document, ...current]);
      setTitle("");
      // Creating a document and not being taken to it is the one case where a
      // new tab is clearly wanted.
      window.open(data.document.editUrl, "_blank", "noopener");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <HubCard
      title="Documents"
      blurb="Collaborative docs in the group's storage."
      glyph="✎"
      accent="blue"
      preview={
        latest ? (
          <>
            <span className="hub-preview-line">{latest.title}</span>
            <span className="hub-preview-cue">
              {formatDay(latest.createdAt)}
              {documents.length > 1 && ` · ${documents.length} docs`}
            </span>
          </>
        ) : (
          <span className="hub-preview-empty">No documents yet</span>
        )
      }
    >
      <div className="hub-panel">
        <form className="hub-form" onSubmit={create}>
          <label htmlFor="doc-title">Start a document</label>
          <span className="hub-inline-form">
            <input
              id="doc-title"
              className="hub-input"
              value={title}
              maxLength={200}
              placeholder="Meeting notes, a proposal, a shared list…"
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="submit"
              className="hub-btn hub-btn--primary"
              disabled={creating}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </span>
          {error && (
            <p className="hub-error" role="alert">
              {error}
            </p>
          )}
          <p className="hub-muted">
            Opens in Nextcloud Text, editable by everyone in the group at the
            same time. Saved to the IFAC folder.
          </p>
        </form>

        <h4 className="hub-panel-subhead">
          {documents.length ? "The group's documents" : "No documents yet"}
        </h4>
        <ul className="hub-list">
          {documents.map((doc) => (
            <li key={doc.id} className="hub-list-row">
              <a
                className="hub-file"
                href={doc.editUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span aria-hidden>✎</span>
                <span className="hub-list-title">{doc.title}</span>
                <span className="hub-muted">{formatDay(doc.createdAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </HubCard>
  );
}
