"use client";

import { useState } from "react";
import { SurfaceCard, SurfaceFrame, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { marketplaceLinks, storeEntry, type StoreEntryState } from "@elkdonis/commerce/links";
import type { ProfileSummary } from "@/lib/hub-data";

/**
 * What this member shows on their own public page, plus where their
 * marketplace store stands.
 *
 * The store fields are the store's real status rather than a boolean: a
 * member with an application under review needs to be told that, not offered
 * the "open a store" button again.
 */
export interface HubSections {
  elkdonisFeed: boolean;
  store: boolean;
  blog: boolean;
  storeState: StoreEntryState;
  storeId: string | null;
  storeName: string | null;
}

/**
 * What used to be this app's whole "My profile" tile.
 *
 * Identity — name, portrait, bio, links — moved onto the shared profile
 * surface (see ProfileFace/connectors.profile in hub/page.tsx and
 * HubSurfaces.tsx): it is the same `users` row every org site edits, and the
 * shared surface edits it in place instead of bouncing the member to a
 * different domain to do it.
 *
 * What is left here is genuinely this site's own: the ArtDirect-style
 * gallery/portfolio counts nothing else in the network has a column for, and
 * the two page-section toggles (the Elkdonis blog feed, the marketplace
 * store) that decide what shows at the bottom of this person's public page
 * on THIS site. Neither has a shared surface to live in, so this stays a
 * `custom` one.
 */
export function PageSectionsFace({
  summary,
  sections,
  marketplaceUrl,
}: {
  summary: ProfileSummary | null;
  sections: HubSections;
  marketplaceUrl?: string;
}) {
  // `marketplaceUrl` used to be accepted here and then dropped: it never
  // reached `props`, so the surface read `undefined`, and every link it built
  // came out relative — a member pressing "Open a store" landed on IFAC's own
  // /studio/apply, which does not exist.
  const descriptor = {
    type: "custom" as const,
    key: "page-sections",
    title: "Page sections",
    kind: "neutral" as const,
    props: { summary, sections, marketplaceUrl },
  };

  if (!summary) {
    return (
      <SurfaceCard
        kind="neutral"
        glyph="▤"
        title="Page sections"
        blurb="What shows on your public page, and what it holds."
        surface={descriptor}
        preview={<span className="eac-preview-empty">Profile not set up</span>}
      />
    );
  }

  const on = [
    sections.blog && "Writing",
    sections.elkdonisFeed && "Blog feed",
    sections.store && "Store",
  ].filter(Boolean);

  const storeNote =
    sections.storeState === "active"
      ? "Store open"
      : sections.storeState === "pending"
        ? "Store application in review"
        : null;

  return (
    <SurfaceCard
      kind="neutral"
      glyph="▤"
      title="Page sections"
      blurb="What shows on your public page, and what it holds."
      surface={descriptor}
      preview={
        <>
          <span className="eac-preview-line">
            {summary.galleryCount
              ? `${summary.galleryCount} piece${summary.galleryCount === 1 ? "" : "s"}`
              : "No work featured yet"}
            {summary.galleriesCount
              ? ` · ${summary.galleriesCount} ${summary.galleriesCount === 1 ? "gallery" : "galleries"}`
              : ""}
          </span>
          <span className="eac-preview-cue">
            {on.length ? `Showing: ${on.join(", ")}` : "No optional sections on"}
            {storeNote ? ` · ${storeNote}` : ""}
          </span>
        </>
      }
    />
  );
}

export function PageSectionsSurface({
  descriptor,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "custom" }>;
}) {
  const summary = (descriptor.props?.summary as ProfileSummary | null) ?? null;
  const sections = (descriptor.props?.sections as HubSections) ?? {
    elkdonisFeed: false,
    store: false,
    blog: false,
    storeState: "none" as const,
    storeId: null,
    storeName: null,
  };
  const marketplaceUrl = (descriptor.props?.marketplaceUrl as string | undefined) ?? "";

  const [feedOn, setFeedOn] = useState(sections.elkdonisFeed);
  const [blogOn, setBlogOn] = useState(sections.blog);
  const [storeOn, setStoreOn] = useState(sections.store);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One builder for every marketplace address, told which app the member is
  // coming from so art-auction can offer them the way back.
  const links = marketplaceLinks(marketplaceUrl, { from: "ifac" });
  const entry = storeEntry(links, sections.storeState, {
    storeId: sections.storeId,
    storeName: sections.storeName,
  });

  async function patch(body: Record<string, boolean>, revert: () => void) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/profile-sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // Put the switch back where it was: a toggle that stays flipped after
        // a failed save tells the member something is on when it isn't.
        revert();
        setError((await res.json().catch(() => null))?.error ?? "Could not save that.");
      }
    } catch {
      revert();
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  const profileHref = summary?.slug
    ? `/${summary.kind === "dealer" ? "dealers" : "artists"}/${summary.slug}`
    : null;

  if (!summary) {
    return (
      <SurfaceFrame kind="neutral" title="Page sections">
        <div className="hub-panel">
          <p>
            There&rsquo;s no profile record for your account yet. An owner or guide
            can create one, or claim an existing directory entry for you.
          </p>
        </div>
      </SurfaceFrame>
    );
  }

  return (
    <SurfaceFrame kind="neutral" title="Page sections" kicker={summary.displayName}>
      <div className="hub-panel">
        <dl className="hub-facts">
          <dt>Featured work</dt>
          <dd>
            {summary.galleryCount
              ? `${summary.galleryCount} piece${summary.galleryCount === 1 ? "" : "s"}`
              : "Empty"}
          </dd>
          <dt>Galleries</dt>
          <dd>
            {summary.galleriesCount
              ? `${summary.galleriesCount} page${summary.galleriesCount === 1 ? "" : "s"}`
              : "None yet — start one from your page"}
          </dd>
        </dl>

        <div className="hub-panel-actions">
          {profileHref ? (
            <>
              <a className="hub-btn hub-btn--primary" href={`${profileHref}?edit=1`}>
                Edit my page
              </a>
              <a className="hub-btn" href={profileHref}>
                View my page
              </a>
            </>
          ) : (
            <p className="hub-muted">
              Your profile has no address yet, so it can&rsquo;t be opened. An owner
              or guide can set one.
            </p>
          )}
        </div>

        <h4 className="hub-panel-subhead">Sections on your page</h4>
        <label className="hub-toggle">
          <input
            type="checkbox"
            checked={blogOn}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.checked;
              setBlogOn(next);
              void patch({ blog: next }, () => setBlogOn(!next));
            }}
          />
          <span>
            <strong>My writing</strong>
            <span className="hub-muted">
              A reading room on your page: your own pieces, written and
              published by you. Nothing you write here goes into IFAC&rsquo;s
              feed or the forum &mdash; it is yours.
              {profileHref && (
                <>
                  {" "}
                  <a href={`${profileHref}/writing`}>Open it</a>.
                </>
              )}
            </span>
          </span>
        </label>

        <label className="hub-toggle">
          <input
            type="checkbox"
            checked={feedOn}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.checked;
              setFeedOn(next);
              void patch({ elkdonisFeed: next }, () => setFeedOn(!next));
            }}
          />
          <span>
            <strong>Elkdonis blog feed</strong>
            <span className="hub-muted">
              Show the network&rsquo;s latest posts at the bottom of your page.
            </span>
          </span>
        </label>

        {sections.storeState === "active" && (
          <label className="hub-toggle">
            <input
              type="checkbox"
              checked={storeOn}
              disabled={saving}
              onChange={(e) => {
                const next = e.target.checked;
                setStoreOn(next);
                void patch({ store: next }, () => setStoreOn(!next));
              }}
            />
            <span>
              <strong>My store</strong>
              <span className="hub-muted">
                Show your listed work from the network marketplace on your page.
                Buying happens there, and you are paid directly.
              </span>
            </span>
          </label>
        )}

        {/* The marketplace is a different app on a different domain, so this
            is a departure, not a tab. Say where it goes and what state the
            store is in before the member commits to the trip. */}
        <h4 className="hub-panel-subhead">Selling your work</h4>
        <p className="hub-muted">{entry.hint}</p>
        <div className="hub-panel-actions">
          <a
            className={entry.ready ? "hub-btn hub-btn--primary" : "hub-btn"}
            href={entry.href}
          >
            {entry.label}
          </a>
          {sections.storeState === "active" && (
            <>
              <a className="hub-btn" href={links.newListing}>
                Add a piece
              </a>
              <a className="hub-btn" href={links.sales}>
                My sales
              </a>
            </>
          )}
        </div>

        {error && (
          <p className="hub-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </SurfaceFrame>
  );
}
