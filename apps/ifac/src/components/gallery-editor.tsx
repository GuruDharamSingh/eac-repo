"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LiveEditor, type FieldDef } from "@elkdonis/live-editor";
import { ProfileGallery, type GalleryItem } from "@elkdonis/cms-ui/gallery";
import type { ThemeVars } from "@elkdonis/services";
import {
  saveGalleryItemsAction,
  saveGalleryFieldAction,
  saveGallerySettingsAction,
  setGalleryPublicAction,
  deleteGalleryAction,
} from "@/lib/gallery-actions";
import { IFAC_THEME_VARS } from "@/lib/theme-tokens";

/**
 * One gallery page's grid, plus — for the owner — the live editor over it.
 *
 * Everything the owner can do happens here, on the page itself:
 *   - the grid: upload, add from their files (own folder + IFAC's library),
 *     drag to reorder, drag the corner to resize, rename, remove;
 *   - the title and description, through pencil pins;
 *   - the look, through style pins on the framed sections and the full
 *     Styles panel — saved on THIS gallery, so each page can be framed its
 *     own way;
 *   - whether the page is public, and deleting it.
 *
 * Read-only for everyone else: the same grid, no controls, and the lightbox.
 */
export function GalleryEditor({
  galleryId,
  title,
  description,
  isPublic,
  settings,
  items,
  memberSlug,
  profileHref,
  editable,
  startEditing,
}: {
  galleryId: string;
  title: string;
  description: string;
  isPublic: boolean;
  settings: ThemeVars;
  items: GalleryItem[];
  memberSlug: string;
  profileHref: string;
  editable: boolean;
  startEditing: boolean;
}) {
  const router = useRouter();
  const [publicState, setPublicState] = useState(isPublic);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Every drag/resize fires onChange; coalesce so a reorder is one write.
  function scheduleSave(next: GalleryItem[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await saveGalleryItemsAction(galleryId, next);
      setStatus(result.ok ? null : result.error ?? "Could not save the gallery.");
    }, 400);
  }

  const fields: FieldDef[] = [
    { trait: "galleryTitle", label: "Gallery title", input: "text", initialValue: title },
    { trait: "galleryDescription", label: "Description", input: "textarea", initialValue: description,
      hint: "Shown under the title. Blank lines separate paragraphs." },
  ];

  function togglePublic() {
    const next = !publicState;
    setPublicState(next);
    startTransition(async () => {
      const result = await setGalleryPublicAction(galleryId, next);
      if (!result.ok) {
        setPublicState(!next);
        setStatus(result.error ?? "Could not change that.");
      }
    });
  }

  function remove() {
    if (!window.confirm("Delete this gallery page? The images stay in your files; only the page goes.")) return;
    startTransition(async () => {
      const result = await deleteGalleryAction(galleryId);
      if (!result.ok) {
        setStatus(result.error ?? "Could not delete the gallery.");
        return;
      }
      router.push(profileHref);
    });
  }

  return (
    <>
      {editable && (
        <>
          <LiveEditor
            fields={fields}
            role="Owner"
            initialEditMode={startEditing}
            onSaveField={(payload) => saveGalleryFieldAction(galleryId, payload)}
            cssVars={IFAC_THEME_VARS}
            cssOverrides={settings}
            onSaveCss={(vars) => saveGallerySettingsAction(galleryId, vars)}
          />
          <div className="gallery-page-tools">
            <button type="button" className="button-secondary" onClick={togglePublic} disabled={pending}>
              {publicState ? "Public — click to hide" : "Hidden — click to publish"}
            </button>
            <span>{publicState ? "Anyone with the link can see this page." : "Only you (and admins) can see this page."}</span>
            {status && <span className="gallery-new-error" style={{ width: "auto" }}>{status}</span>}
            <button type="button" className="button-secondary is-danger" onClick={remove} disabled={pending}>
              Delete gallery
            </button>
          </div>
        </>
      )}

      <section className="gallery-page-body" data-theme-vars="--frame,--frame-width,--frame-soft" data-theme-label="Gallery frame">
        {items.length === 0 && !editable ? (
          <p className="profile-no-work">Nothing here yet.</p>
        ) : (
          <ProfileGallery
            items={items}
            editable={editable}
            uploadEndpoint="/api/upload"
            uploadExtraFields={{ memberSlug, target: "file" }}
            libraryEndpoint="/api/my-media"
            librarySourceLabels={{ user: "My files", org: "IFAC library" }}
            emptyHint="Upload images, or add ones already in your files. Drag to reorder; drag a corner to resize."
            onChange={editable ? scheduleSave : undefined}
          />
        )}
      </section>
    </>
  );
}
