"use client";

import * as React from "react";
import { SurfaceCard, fmtShortDate, useSurface, type SurfaceDocument } from "../surface";
import { faceOf } from "./face-origin";

// ============================================================================
// "Create a document", as a face.
//
// The face shows the group's CURRENT living document — its title and the first
// lines of what is actually in it — so the tile answers "what are we working
// on" before anyone clicks. Opening it goes to the document itself, not to a
// list about it.
//
// When there is no current document the face makes the smaller offer instead:
// start a scrap doc. Naming a document is a decision about a thing you have
// not written yet, and it is the step at which most notes never get taken, so
// the scrap route asks for nothing — the host names it by date and it can be
// titled, or assigned to an idea, later.
//
// Both buttons sit in `.eac-face-live`; the rest of the face opens the list.
//
// HEADER-LED, and named for what it is (2026-09-16). It was titled
// "Documents", which in a hub that also has a Files tile and a shared drive
// names three different things the same way. These are collaboratively-edited
// Nextcloud documents, so the card says so, and a second line says which tool
// opens — the question a member actually has is "is this a word processor or
// a folder", and the card can simply answer it.
//
// Below that the face lists what is THERE, as a short directory with a mark
// per entry, instead of one document and a snippet. A group with four living
// documents was being shown one of them.
// ============================================================================

/** A mark per kind of thing, so a row is scannable without reading it. */
function docGlyph(doc: SurfaceDocument): string {
  const name = (doc.title ?? "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(name)) return "▣";
  if (/\.(pdf)$/.test(name)) return "▤";
  if (/\.(mp4|mov|webm|avi)$/.test(name)) return "▶";
  if (/\.(mp3|wav|m4a|flac)$/.test(name)) return "♪";
  if (/\.(xlsx?|csv|ods)$/.test(name)) return "▦";
  // The default is the thing this face is actually for: a living text doc.
  return "▭";
}

export function DocumentsFace({
  documents,
  canCreate = true,
}: {
  /** Newest first. The head of this list is "the current living doc". */
  documents: SurfaceDocument[];
  canCreate?: boolean;
}) {
  const surfaces = useSurface();
  const [starting, setStarting] = React.useState(false);
  const { connectors } = surfaces;

  const current = documents[0];
  const openList = (draftTitle?: string, origin: HTMLElement | null = null) =>
    surfaces.open({ type: "documents", documents, draftTitle }, origin);

  async function startScrap() {
    const create = connectors.documents?.create;
    // No connector means no way to make one here; send them to the panel,
    // which says so properly rather than failing under the pointer.
    if (!create) {
      openList();
      return;
    }
    setStarting(true);
    const result = await create({});
    setStarting(false);
    if (!result.ok) {
      openList();
      return;
    }
    connectors.onMutated?.();
    window.open(result.document.editUrl, "_blank", "noopener");
  }

  return (
    <SurfaceCard
      kind="document"
      layout="header"
      // No kicker: the kind's label is "Document", which directly above a
      // title reading "Collaborative document" says the word twice.
      kicker={null}
      title="Collaborative document"
      blurb="Nextcloud word processor, for editing together or taking notes."
      ariaLabel="Open the group's documents"
      onClick={(origin) => openList(undefined, origin)}
      preview={
        <div className="eac-face-live eac-doc-face">
          {current ? (
            <>
              {/* The directory, newest first. Each row opens that document
                  directly; the card itself opens the full list. */}
              <div className="eac-doc-dir">
                {documents.slice(0, 4).map((doc) => (
                  <a
                    key={doc.id}
                    className="eac-doc-dir-row"
                    href={doc.editUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="eac-doc-dir-glyph" aria-hidden>
                      {docGlyph(doc)}
                    </span>
                    <span className="eac-doc-dir-name">{doc.title}</span>
                    <span className="eac-doc-dir-when">
                      {fmtShortDate(doc.updatedAt ?? doc.createdAt)}
                    </span>
                  </a>
                ))}
              </div>
              {documents.length > 4 && (
                <span className="eac-preview-cue">
                  +{documents.length - 4} more
                </span>
              )}
              {canCreate && (
                <button
                  type="button"
                  className="eac-preview-action eac-preview-action--quiet"
                  onClick={(e) => openList("", faceOf(e.currentTarget))}
                >
                  Start another
                </button>
              )}
            </>
          ) : (
            <>
              <span className="eac-preview-empty">
                Nothing living yet. Start rough — you can name it later.
              </span>
              {canCreate && (
                <span className="eac-doc-face-offer">
                  <button
                    type="button"
                    className="eac-preview-action"
                    disabled={starting}
                    onClick={() => void startScrap()}
                  >
                    {starting ? "Starting…" : "Scrap doc"}
                  </button>
                  <button
                    type="button"
                    className="eac-preview-action eac-preview-action--quiet"
                    onClick={(e) => openList("", faceOf(e.currentTarget))}
                  >
                    Name one…
                  </button>
                </span>
              )}
            </>
          )}
        </div>
      }
    />
  );
}
