"use client";

import { useEffect, useRef, useState } from "react";
import { ProfileGallery, type GalleryItem } from "./ProfileGallery";

/**
 * Choose what one site shows of a person's work (2026-11-11).
 *
 * Each org site keeps its own portfolio list (org_profiles.portfolio,
 * migration 264), apart from the person's home list on ArtDirect. This is the
 * editor for that list on the site itself: the same ProfileGallery IFAC's
 * artist page uses, with "Add from your files" offering the person's home list
 * and their own folder, and uploads filed in their own folder.
 *
 * The host mounts `sitePortfolioRoutes` (@elkdonis/services) at `endpoint` and
 * renders this only for the person or an admin (getPersonPage's `canEdit`);
 * the routes check again. Visitors keep the read-only list.
 * docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md
 */
export interface SitePortfolioEditorProps {
  /** This site's list for the person, as getPersonPage returns it. */
  items: GalleryItem[];
  /** The person's users.slug. */
  person: string;
  /** Where the host mounted sitePortfolioRoutes. Saves accept only the person's own library. */
  endpoint?: string;
  /** "Para Theater": named in the note above the grid. */
  siteName?: string;
  /** A downscaled tile address, e.g. `${url}?w=512`. */
  thumb?: (url: string) => string;
}

export function SitePortfolioEditor({
  items: initial,
  person,
  endpoint = "/api/center/portfolio",
  siteName,
  thumb,
}: SitePortfolioEditorProps) {
  const [items, setItems] = useState<GalleryItem[]>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<GalleryItem[]>(initial);

  async function save(next: GalleryItem[]) {
    setStatus("saving");
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ person, items: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `Could not save (${res.status})`);
      setStatus("saved");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError((err as Error).message);
    }
  }

  // ProfileGallery fires on every drag step; one save per pause.
  function onChange(next: GalleryItem[]) {
    setItems(next);
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(latest.current), 600);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const where = siteName ? `on ${siteName}` : "on this site";
  return (
    <div className="eac-site-portfolio" data-site-portfolio="">
      <p className="eac-site-portfolio-note">
        The pictures shown {where} are chosen here, from your files. Your ArtDirect portfolio and other sites do not
        change them.
        {status === "saving" ? " Saving…" : status === "saved" ? " Saved." : null}
      </p>
      {status === "error" && error ? (
        <p className="eac-site-portfolio-note" role="alert">
          {error}
        </p>
      ) : null}
      <ProfileGallery
        items={items}
        editable
        onChange={onChange}
        uploadEndpoint={endpoint}
        uploadExtraFields={{ person }}
        libraryEndpoint={`${endpoint}?person=${encodeURIComponent(person)}`}
        librarySourceLabels={{ page: "Your ArtDirect portfolio", user: "Your files" }}
        emptyHint={`Nothing shown ${where} yet. Upload a picture or add one from your files.`}
        thumb={thumb}
      />
    </div>
  );
}
