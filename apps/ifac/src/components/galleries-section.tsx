"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserGallerySummary } from "@elkdonis/services";
import { createGalleryAction } from "@/lib/gallery-actions";
import { FRAME_THEME_VARS } from "@/lib/theme-tokens";

/**
 * The list of a person's gallery pages on their profile, and — for the
 * owner — the way to start a new one.
 *
 * Creating is deliberately one field: a title. Everything else (images,
 * description, look, whether it's public) is done ON the new page with the
 * live editor, which is the same "see the change where it applies" rule the
 * rest of the profile editing follows.
 */
export function GalleriesSection({
  profileUserId,
  profileSlug,
  kind,
  galleries,
  editable,
}: {
  profileUserId: string;
  profileSlug: string;
  kind: "artists" | "dealers";
  galleries: UserGallerySummary[];
  editable: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (galleries.length === 0 && !editable) return null;

  function create() {
    const t = title.trim();
    if (!t) return;
    setError(null);
    startTransition(async () => {
      const result = await createGalleryAction(profileUserId, t);
      if (!result.ok || !result.slug) {
        setError(result.error ?? "Could not create the gallery.");
        return;
      }
      setTitle("");
      router.push(`/${kind}/${profileSlug}/galleries/${result.slug}?edit=1`);
    });
  }

  return (
    <section className="profile-galleries" data-theme-vars={FRAME_THEME_VARS} data-theme-label="Galleries">
      <div className="profile-galleries-head">
        <h2 className="profile-galleries-title">Galleries</h2>
        {editable && (
          <span className="gallery-card-meta">
            {galleries.length ? `${galleries.length} page${galleries.length === 1 ? "" : "s"}` : "Start one below"}
          </span>
        )}
      </div>

      {galleries.length > 0 && (
        <div className="gallery-cards">
          {galleries.map((g) => (
            <a key={g.id} className="gallery-card" href={`/${kind}/${profileSlug}/galleries/${g.slug}`}>
              {g.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="gallery-card-cover" src={g.coverUrl} alt="" loading="lazy" />
              ) : (
                <div className="gallery-card-cover gallery-card-cover--blank">No images yet</div>
              )}
              <div className="gallery-card-body">
                <h3 className="gallery-card-title">
                  {g.title}
                  {editable && !g.isPublic && <span className="gallery-card-draft">Hidden</span>}
                </h3>
                <p className="gallery-card-meta">
                  {g.itemCount ? `${g.itemCount} image${g.itemCount === 1 ? "" : "s"}` : "Empty"}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      {editable && (
        <form
          className="gallery-new"
          onSubmit={(e) => { e.preventDefault(); create(); }}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New gallery title — a series, a show, a year…"
            maxLength={160}
            aria-label="New gallery title"
            disabled={pending}
          />
          <button type="submit" className="button-secondary" disabled={pending || !title.trim()}>
            {pending ? "Creating…" : "+ New gallery"}
          </button>
          {error && <p className="gallery-new-error">{error}</p>}
        </form>
      )}
    </section>
  );
}
