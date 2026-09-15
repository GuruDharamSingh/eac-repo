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
// ============================================================================

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
      title={current ? "Documents" : "Create a document"}
      blurb={
        current
          ? "What the group is working on, in shared storage."
          : "A collaborative doc in the group's storage — no account needed."
      }
      ariaLabel="Open the group's documents"
      onClick={(origin) => openList(undefined, origin)}
      preview={
        <div className="eac-face-live eac-doc-face">
          {current ? (
            <>
              <a
                className="eac-doc-face-current"
                href={current.editUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="eac-doc-face-title">{current.title}</span>
                {current.snippet && (
                  <span className="eac-doc-face-snippet">{current.snippet}</span>
                )}
                <span className="eac-preview-cue">
                  {[
                    fmtShortDate(current.updatedAt ?? current.createdAt),
                    current.ideaTitle ? `for “${current.ideaTitle}”` : null,
                    documents.length > 1 ? `${documents.length} docs` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </a>
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
