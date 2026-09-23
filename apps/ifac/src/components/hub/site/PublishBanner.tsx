"use client";

import * as React from "react";
import { CalendarDays, Frame, LayoutGrid, Mail, PenLine, Share2 } from "lucide-react";
import { useSurface } from "@elkdonis/cms-ui/surface";

/**
 * "Publish" on the page layout — a row of large doors, one per thing a member
 * can put out, replacing the one-line compose bar (owner, 2026-09-23: "you
 * can publish writing, meeting, artwork, Substack, social media").
 *
 * Each door opens what the Publish card's catalogue would have opened for
 * that kind, so there is still one composer per kind on this site:
 *   Writing  → the writing room page (/hub/compose?kind=post), or the
 *              members' submission form for someone who cannot publish
 *   Meeting  → the compose popup, meeting form (guides and owners only —
 *              the catalogue's own `canPublishDated` gate)
 *   Artwork  → the art piece form (`compose:art-piece`)
 *   More     → the whole catalogue: event, workshop, poll, questionnaire, blog
 *
 * Substack and social media are shown as "Coming" and do nothing. Neither
 * exists yet: there is no Substack integration in the repo, and social posting
 * waits on the Meta work in packages/meta. They are drawn so the set reads as
 * the owner described it, and dashed so nobody mistakes them for working doors.
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

export function PublishBanner() {
  const { connectors, open } = useSurface();

  const canCompose = Boolean(connectors.viewer.canCompose && connectors.saveThread);
  const canPostTo = Boolean(connectors.postTo);
  if (!canCompose && !canPostTo) return null;

  const canDate = canCompose && connectors.compose?.canPublishDated !== false;
  const hasArtwork = Boolean(connectors.compose?.hasArtworks && connectors.custom?.["compose:art-piece"]);

  const doors: Door[] = [
    canCompose
      ? { id: "writing", label: "Writing", note: "A post, an article, an update", icon: <PenLine />, href: "/hub/compose?kind=post" }
      : {
          id: "writing",
          label: "Writing",
          note: "Send something to the group",
          icon: <PenLine />,
          onOpen: (el) => open({ type: "postTo" }, el),
        },
  ];
  if (canDate) {
    doors.push({
      id: "meeting",
      label: "Meeting",
      note: "A gathering people can join",
      icon: <CalendarDays />,
      onOpen: (el) => open({ type: "compose", kind: "meeting", tier: "full" }, el),
    });
  }
  if (hasArtwork) {
    doors.push({
      id: "artwork",
      label: "Artwork",
      note: "A work, with its picture",
      icon: <Frame />,
      onOpen: (el) => open({ type: "custom", key: "compose:art-piece", title: "Art piece", kind: "product" }, el),
    });
  }
  doors.push(
    { id: "substack", label: "Substack", note: "Send to your newsletter", icon: <Mail />, soon: true },
    { id: "social", label: "Social media", note: "Facebook and Instagram", icon: <Share2 />, soon: true }
  );
  if (canCompose) {
    doors.push({
      id: "more",
      label: "Everything else",
      note: "Event, workshop, poll",
      icon: <LayoutGrid />,
      onOpen: (el) => open({ type: "compose" }, el),
    });
  }

  return (
    <section className="ifac-publish" aria-labelledby="ifac-publish-h">
      <header className="ifac-publish__head">
        <h2 id="ifac-publish-h" className="ifac-publish__title">
          Publish
        </h2>
        <p className="ifac-publish__sub">What would you like to put out?</p>
      </header>
      <ul className="ifac-publish__doors">
        {doors.map((d) => (
          <li key={d.id}>
            {d.soon ? (
              <span className="ifac-publish__door is-soon" aria-disabled="true">
                <span className="ifac-publish__icon" aria-hidden>
                  {d.icon}
                </span>
                <span className="ifac-publish__label">{d.label}</span>
                <span className="ifac-publish__note">Coming soon</span>
              </span>
            ) : d.href ? (
              <a className="ifac-publish__door" href={d.href}>
                <span className="ifac-publish__icon" aria-hidden>
                  {d.icon}
                </span>
                <span className="ifac-publish__label">{d.label}</span>
                <span className="ifac-publish__note">{d.note}</span>
              </a>
            ) : (
              <button
                type="button"
                className="ifac-publish__door"
                aria-haspopup="dialog"
                onClick={(e) => d.onOpen?.(e.currentTarget)}
              >
                <span className="ifac-publish__icon" aria-hidden>
                  {d.icon}
                </span>
                <span className="ifac-publish__label">{d.label}</span>
                <span className="ifac-publish__note">{d.note}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
