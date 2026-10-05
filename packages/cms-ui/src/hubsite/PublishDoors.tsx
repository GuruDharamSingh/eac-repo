"use client";

import * as React from "react";
import { useSurface } from "../surface";

/**
 * "Publish" on a hub's page layout: one door per thing a member can put out
 * — Writing, Meeting, Artwork, then Substack and social media (not built
 * yet, drawn dashed) and the rest of the compose catalogue.
 *
 * First built in apps/ifac (owner, 2026-09-23), moved here 2026-09-26 so
 * innergathering's hub uses the same doors. Each door opens what the compose
 * catalogue would have opened for that kind, so there is still one composer
 * per kind on a site:
 *   Writing  → `writingHref` (the writing room page), or the members'
 *              "Post to…" form for someone who cannot publish
 *   Meeting  → the compose popup's meeting form (only when the host allows
 *              dated items for this person: `compose.canPublishDated`)
 *   Artwork  → the host's art piece form (`custom["compose:art-piece"]`)
 *   More     → the whole compose catalogue
 *
 * Variants: `row` (three across, large doors), `compact` (three across,
 * smaller doors — under a hub calendar), `column` (one per row).
 */
type Door = {
  id: string;
  label: string;
  note: string;
  icon: React.ReactNode;
  href?: string;
  onOpen?: (el: HTMLElement) => void;
  soon?: boolean;
};

export interface PublishDoorsProps {
  variant?: "row" | "compact" | "column";
  /** Where the Writing door goes for someone who can publish. */
  writingHref?: string;
  /** Draw the not-yet-built Substack and social media doors. Default true. */
  showComingSoon?: boolean;
  title?: string;
  subtitle?: string;
}

export function PublishDoors({
  variant = "row",
  writingHref = "/hub/compose?kind=post",
  showComingSoon = true,
  title = "Publish",
  subtitle = "What would you like to put out?",
}: PublishDoorsProps) {
  const { connectors, open } = useSurface();
  const headingId = React.useId();

  const canCompose = Boolean(connectors.viewer.canCompose && connectors.saveThread);
  const canPostTo = Boolean(connectors.postTo);
  if (!canCompose && !canPostTo) return null;

  const canDate = canCompose && connectors.compose?.canPublishDated !== false;
  const hasArtwork = Boolean(connectors.compose?.hasArtworks && connectors.custom?.["compose:art-piece"]);

  const doors: Door[] = [
    canCompose
      ? { id: "writing", label: "Writing", note: "A post, an article, an update", icon: <PenIcon />, href: writingHref }
      : {
          id: "writing",
          label: "Writing",
          note: "Send something to the group",
          icon: <PenIcon />,
          onOpen: (el) => open({ type: "postTo" }, el),
        },
  ];
  if (canDate) {
    doors.push({
      id: "meeting",
      label: "Meeting",
      note: "A gathering people can join",
      icon: <CalendarIcon />,
      onOpen: (el) => open({ type: "compose", kind: "meeting", tier: "full" }, el),
    });
  }
  if (hasArtwork) {
    doors.push({
      id: "artwork",
      label: "Artwork",
      note: "A work, with its picture",
      icon: <FrameIcon />,
      onOpen: (el) => open({ type: "custom", key: "compose:art-piece", title: "Art piece", kind: "product" }, el),
    });
  }
  if (showComingSoon) {
    doors.push(
      { id: "substack", label: "Substack", note: "Send to your newsletter", icon: <MailIcon />, soon: true },
      { id: "social", label: "Social media", note: "Facebook and Instagram", icon: <ShareIcon />, soon: true }
    );
  }
  if (canCompose) {
    doors.push({
      id: "more",
      label: "Everything else",
      note: "Event, workshop, poll",
      icon: <GridIcon />,
      onOpen: (el) => open({ type: "compose" }, el),
    });
  }

  return (
    <section className={`eac-hs-publish eac-hs-publish--${variant}`} aria-labelledby={headingId}>
      <header className="eac-hs-publish__head">
        <h2 id={headingId} className="eac-hs-publish__title">
          {title}
        </h2>
        {subtitle && <p className="eac-hs-publish__sub">{subtitle}</p>}
      </header>
      <ul className="eac-hs-publish__doors">
        {doors.map((d) => {
          const inner = (
            <>
              <span className="eac-hs-publish__icon" aria-hidden>
                {d.icon}
              </span>
              <span className="eac-hs-publish__label">{d.label}</span>
              <span className="eac-hs-publish__note">{d.soon ? "Coming soon" : d.note}</span>
            </>
          );
          return (
            <li key={d.id}>
              {d.soon ? (
                <span className="eac-hs-publish__door is-soon" aria-disabled="true">
                  {inner}
                </span>
              ) : d.href ? (
                <a className="eac-hs-publish__door" href={d.href}>
                  {inner}
                </a>
              ) : (
                <button
                  type="button"
                  className="eac-hs-publish__door"
                  aria-haspopup="dialog"
                  onClick={(e) => d.onOpen?.(e.currentTarget)}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Line icons drawn inline: cms-ui carries no icon library.
function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const PenIcon = () => (
  <Svg>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);
const CalendarIcon = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);
const FrameIcon = () => (
  <Svg>
    <path d="M22 6H2M22 18H2M6 2v20M18 2v20" />
  </Svg>
);
const MailIcon = () => (
  <Svg>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </Svg>
);
const ShareIcon = () => (
  <Svg>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </Svg>
);
const GridIcon = () => (
  <Svg>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </Svg>
);
