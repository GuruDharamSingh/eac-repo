"use client";

import * as React from "react";
import { SurfaceFrame, useSurfaceOptional, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { studioHref, useOpenStudio } from "./studio-surface";

// ============================================================================
// The Publish door (round 4): a small chooser, then the Studio popup for that
// kind. On /hub (a card) and in the account menu, for editors.
//
//   Writing — a piece for the Writing page          → Studio, Writing, feed writing
//   Post    — a shorter post on another page         → Studio, Writing, feed chosen here
//   Service — a reading or counselling session       → Studio, Services
//   Event   — coming (this site shows no dates yet)
// ============================================================================

export const CHOOSER_SURFACE = "studio:choose";

export const chooserDescriptor: Extract<SurfaceDescriptor, { type: "custom" }> = {
  type: "custom",
  key: CHOOSER_SURFACE,
  title: "Publish",
  size: "compact",
  kind: "post",
};

type Feed = { slug: string; name: string };

const rowStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  width: "100%",
  textAlign: "left",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid color-mix(in oklab, currentColor 18%, transparent)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
};

export function PublishChooser({ feeds }: { feeds: Feed[] }) {
  const open = useOpenStudio();
  // "Post" goes on any page but the two that have their own door.
  const postFeeds = feeds.filter((f) => f.slug !== "writing" && f.slug !== "services");
  const [postFeed, setPostFeed] = React.useState(postFeeds[0]?.slug ?? "writing");
  const hasWriting = feeds.some((f) => f.slug === "writing");

  return (
    <SurfaceFrame kind="post" title="Publish" kicker="What are you making?">
      <div style={{ display: "grid", gap: 10 }} data-he-publish-chooser="">
        {hasWriting ? (
          <button type="button" style={rowStyle} onClick={() => open({ kind: "writing", feed: "writing" })}>
            <b>Writing</b>
            <span style={{ opacity: 0.75 }}>An essay or a reflection, for the Writing page.</span>
          </button>
        ) : null}
        {postFeeds.length > 0 ? (
          <div style={{ ...rowStyle, cursor: "default" }}>
            <button
              type="button"
              onClick={() => open({ kind: "writing", feed: postFeed })}
              style={{ all: "unset", cursor: "pointer", display: "grid", gap: 2 }}
            >
              <b>Post</b>
              <span style={{ opacity: 0.75 }}>A shorter post, on one of the site’s pages.</span>
            </button>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: 14 }}>
              <span style={{ opacity: 0.75 }}>On</span>
              <select value={postFeed} onChange={(e) => setPostFeed(e.target.value)} aria-label="The page it goes on">
                {postFeeds.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <button type="button" style={rowStyle} onClick={() => open({ kind: "service" })}>
          <b>Service</b>
          <span style={{ opacity: 0.75 }}>A reading or a counselling session people can book.</span>
        </button>
        <div style={{ ...rowStyle, cursor: "default", opacity: 0.55 }} aria-disabled="true">
          <b>Event · soon</b>
          <span>A dated gathering. Coming once the site’s pages can show dates.</span>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.7 }}>
          Opens the Studio over this page. <a href={studioHref()} style={{ textDecoration: "underline" }}>Full screen</a> ·{" "}
          <a href="/manage/content/new" style={{ textDecoration: "underline" }}>the plain form</a>
        </p>
      </div>
    </SurfaceFrame>
  );
}

/** A link in the account menu that opens the chooser; a plain link to /publish without script. */
export function PublishMenuLink({ onOpen, children = "Publish" }: { onOpen?: () => void; children?: React.ReactNode }) {
  const surface = useSurfaceOptional();
  return (
    <a
      href="/publish"
      onClick={(e) => {
        if (!surface || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpen?.();
        // The account menu is a <details>; fold it so it does not sit open behind the dialog.
        e.currentTarget.closest("details")?.removeAttribute("open");
        surface.open(chooserDescriptor, e.currentTarget);
      }}
    >
      {children}
    </a>
  );
}

/**
 * The Publish door as a hub card (round 4 tidy): the same markup as HubLinkCard
 * (`eac-hp-card`), so it sits in the hub grid like its neighbours, and nothing is
 * painted behind it (SurfaceCard drew a ghost of the chooser). Opens the chooser;
 * a plain link to /publish without script or with a modifier key.
 */
export function PublishCard({ blurb = "Writing, a post, or a reading people can book." }: { blurb?: string }) {
  const surface = useSurfaceOptional();
  return (
    <a
      className="eac-hp-card"
      href="/publish"
      aria-haspopup="dialog"
      onClick={(e) => {
        if (!surface || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        surface.open(chooserDescriptor, e.currentTarget);
      }}
    >
      <span className="eac-hp-card-top">
        <span className="eac-hp-card-glyph" aria-hidden>
          ✎
        </span>
        <span className="eac-hp-card-cue" aria-hidden>
          →
        </span>
      </span>
      <span className="eac-hp-card-title">Publish</span>
      <span className="eac-hp-card-blurb">{blurb}</span>
    </a>
  );
}
