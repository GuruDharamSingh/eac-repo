"use client";

import * as React from "react";
import type {
  SurfaceAction,
  SurfaceDescriptor,
  SurfaceDocument,
  SurfaceIdea,
} from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";
import { fmtShortDate } from "../format";

// ============================================================================
// The group's living documents.
//
// Generalised from IFAC's DocumentsCard, which was the only real one in the
// repo — the two template apps had this tile marked `available: false`. The
// panel does three things: start a document, start a SCRAP document, and say
// which idea a document belongs to.
//
// A scrap doc is the whole point of the "or" in the face's offer. Naming a
// document is a decision about a thing you have not written yet, and it is
// the step at which most notes never get taken. So "Start a scrap doc" asks
// nothing: the host names it by date, and it can be titled later — or assigned
// to an idea, which is a better name than a title anyway.
//
// Links open in a new tab rather than an iframe: Nextcloud sends
// `X-Frame-Options: SAMEORIGIN`, so an embedded editor renders as a blank box
// with no error a member could act on.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "documents" }>;

export function DocumentsSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors } = useSurface();
  const layer = useLayer();
  const docs = connectors.documents;

  const [items, setItems] = React.useState<SurfaceDocument[] | null>(
    descriptor.documents ?? null
  );
  const [ideas, setIdeas] = React.useState<SurfaceIdea[]>([]);
  const [title, setTitle] = React.useState(descriptor.draftTitle ?? "");
  const [busy, setBusy] = React.useState<"idle" | "creating" | "scrap" | "assigning">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    layer.setMeta({ title: "Documents", kind: "document", size: "wide" });
  }, [layer]);

  const load = React.useCallback(async () => {
    if (!docs) {
      setItems([]);
      return;
    }
    try {
      setItems(await docs.list());
    } catch {
      setError("Could not load the documents.");
      setItems([]);
    }
  }, [docs]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // The assign control is only worth drawing when there is something to assign
  // to, so the ideas list is fetched alongside — and its failure is silent,
  // because it costs the dropdown, not the panel.
  React.useEffect(() => {
    const list = connectors.ideas?.list;
    if (!list || !docs?.assign) return;
    let live = true;
    void list()
      .then((rows) => {
        if (live) setIdeas(rows);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [connectors.ideas, docs]);

  async function create(scrap: boolean) {
    if (!docs) return;
    const trimmed = title.trim();
    if (!scrap && !trimmed) {
      setError("Give the document a title, or start a scrap doc.");
      return;
    }
    setBusy(scrap ? "scrap" : "creating");
    setError(null);
    setNotice(null);
    const result = await docs.create(scrap ? {} : { title: trimmed });
    setBusy("idle");
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setItems((current) => [result.document, ...(current ?? [])]);
    setTitle("");
    connectors.onMutated?.();
    // Making a document and not being taken to it is the one case where a new
    // tab is plainly wanted.
    window.open(result.document.editUrl, "_blank", "noopener");
  }

  async function assign(documentId: string, ideaId: string | null) {
    if (!docs?.assign) return;
    setBusy("assigning");
    setError(null);
    const result = await docs.assign(documentId, ideaId);
    setBusy("idle");
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    const idea = ideas.find((i) => i.id === ideaId) ?? null;
    setItems((current) =>
      (current ?? []).map((d) =>
        d.id === documentId
          ? { ...d, ideaId, ideaTitle: idea?.title ?? null }
          : d
      )
    );
    setNotice(idea ? `Assigned to “${idea.title}”` : "Unassigned");
    connectors.onMutated?.();
  }

  if (!docs) {
    return (
      <SurfaceFrame kind="document" title="Documents">
        <p className="eac-surface-empty">This site has no document storage wired up.</p>
      </SurfaceFrame>
    );
  }

  const count = items?.length ?? 0;
  const actions: SurfaceAction[] = [
    {
      label: busy === "creating" ? "Creating…" : "Create",
      primary: true,
      disabled: busy !== "idle" || !title.trim(),
      onClick: () => create(false),
    },
    {
      label: busy === "scrap" ? "Starting…" : "Scrap doc",
      quiet: true,
      disabled: busy !== "idle",
      onClick: () => create(true),
    },
  ];

  return (
    <SurfaceFrame
      kind="document"
      title="Documents"
      kicker="The group's storage"
      status={error ?? notice ?? (items === null ? "Loading…" : `${count} ${count === 1 ? "document" : "documents"}`)}
      statusTone={error ? "error" : "normal"}
      actions={actions}
    >
      <form
        className="eac-doc-start"
        onSubmit={(e) => {
          e.preventDefault();
          void create(false);
        }}
      >
        <label className="eac-doc-label" htmlFor="eac-doc-title">
          Start a document
        </label>
        <input
          id="eac-doc-title"
          className="eac-doc-input"
          value={title}
          maxLength={200}
          autoFocus={Boolean(descriptor.draftTitle)}
          placeholder="Meeting notes, a proposal, a shared list…"
          onChange={(e) => setTitle(e.target.value)}
        />
        <p className="eac-doc-hint">
          Opens in Nextcloud Text, editable by everyone in the group at once and
          saved to the group&rsquo;s folder. No account needed — the link is the
          permission. Nothing to call it yet? Start a scrap doc and name it
          later.
        </p>
      </form>

      <h3 className="eac-doc-subhead">
        {count ? "The group’s documents" : "No documents yet"}
      </h3>

      {items === null ? (
        <SurfaceSkeleton />
      ) : (
        <ul className="eac-doc-list">
          {items.map((doc) => (
            <li key={doc.id} className="eac-doc-row">
              <a
                className="eac-doc-open"
                href={doc.editUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="eac-doc-glyph" aria-hidden>
                  ▭
                </span>
                <span className="eac-doc-name">{doc.title}</span>
                {doc.snippet && <span className="eac-doc-snippet">{doc.snippet}</span>}
                <span className="eac-doc-meta">
                  {[
                    doc.createdBy,
                    fmtShortDate(doc.updatedAt ?? doc.createdAt),
                    doc.ideaTitle ? `for “${doc.ideaTitle}”` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </a>

              {docs.assign && ideas.length > 0 && (
                <label className="eac-doc-assign">
                  <span className="eac-doc-label">Idea</span>
                  <select
                    value={doc.ideaId ?? ""}
                    disabled={busy !== "idle"}
                    onChange={(e) => void assign(doc.id, e.target.value || null)}
                  >
                    <option value="">Unassigned</option>
                    {ideas.map((idea) => (
                      <option key={idea.id} value={idea.id}>
                        {idea.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </SurfaceFrame>
  );
}
