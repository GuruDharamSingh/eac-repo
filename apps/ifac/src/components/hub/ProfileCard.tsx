"use client";

import { useState } from "react";
import type { ProfileSummary } from "@/lib/hub-data";
import { HubCard } from "./HubCard";

/**
 * Who is signed in, and what is waiting for them.
 *
 * The editing itself deliberately does NOT happen in this modal. The brief
 * asked for an editor the member can see their page change under, and this is
 * a different route from their page — a form here could only ever show a
 * simulation of their profile. So the modal is the quick look plus the door,
 * and the door opens their real public page with the live editor already on.
 * That editor (ProfileEditorPanel over /artists/[slug]) is the one place edits
 * are visible against the actual layout.
 */
export function ProfileCard({
  summary,
  sections,
  marketplaceUrl,
}: {
  summary: ProfileSummary | null;
  sections: { elkdonisFeed: boolean; store: boolean; hasStore: boolean };
  marketplaceUrl?: string;
}) {
  const [feedOn, setFeedOn] = useState(sections.elkdonisFeed);
  const [storeOn, setStoreOn] = useState(sections.store);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const market = (marketplaceUrl ?? "").replace(/\/$/, "");

  async function toggleStore(next: boolean) {
    setStoreOn(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/profile-sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store: next }),
      });
      if (!res.ok) {
        setStoreOn(!next);
        setError((await res.json()).error ?? "Could not save that.");
      }
    } catch {
      setStoreOn(!next);
      setError("Could not save that.");
    } finally {
      setSaving(false);
    }
  }

  if (!summary) {
    return (
      <HubCard
        title="My profile"
        blurb="Your bio, portrait, links and gallery."
        glyph="✦"
        accent="ink"
        preview={<span className="hub-preview-empty">Profile not set up</span>}
      >
        <div className="hub-panel">
          <p>
            There's no profile record for your account yet. An owner or guide
            can create one, or claim an existing directory entry for you.
          </p>
        </div>
      </HubCard>
    );
  }

  const profileHref = summary.slug ? `/artists/${summary.slug}` : null;
  const alerts =
    summary.unreadMessages + (summary.upcomingCount > 0 ? 1 : 0) > 0;

  async function toggleFeed(next: boolean) {
    setFeedOn(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/profile-sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elkdonisFeed: next }),
      });
      if (!res.ok) {
        // Put the switch back where it was: a toggle that stays flipped after
        // a failed save tells the member something is on when it isn't.
        setFeedOn(!next);
        setError((await res.json()).error ?? "Could not save that.");
      }
    } catch {
      setFeedOn(!next);
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HubCard
      title="My profile"
      blurb={summary.roleTitle ?? summary.headline ?? "Your page on IFAC"}
      glyph="✦"
      accent="ink"
      preview={
        <>
          <span className="hub-preview-person">
            {summary.avatarUrl ? (
              <img
                className="hub-preview-avatar"
                src={summary.avatarUrl}
                alt=""
                loading="lazy"
              />
            ) : (
              <span className="hub-preview-avatar hub-preview-avatar--blank" aria-hidden>
                {summary.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hub-preview-line">{summary.displayName}</span>
          </span>
          {alerts ? (
            <span className="hub-preview-cue">
              {[
                summary.unreadMessages
                  ? `${summary.unreadMessages} unread`
                  : null,
                summary.upcomingCount
                  ? `${summary.upcomingCount} upcoming`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : (
            <span className="hub-preview-cue">Nothing waiting</span>
          )}
        </>
      }
    >
      <div className="hub-panel">
        <div className="hub-profile-head">
          {summary.avatarUrl && (
            <img className="hub-profile-avatar" src={summary.avatarUrl} alt="" />
          )}
          <div>
            <h3 className="hub-panel-title">{summary.displayName}</h3>
            {summary.roleTitle && <p className="hub-muted">{summary.roleTitle}</p>}
          </div>
        </div>

        <dl className="hub-facts">
          <dt>Messages</dt>
          <dd>
            {summary.unreadMessages
              ? `${summary.unreadMessages} unread`
              : "Nothing unread"}
            {summary.unreadMessages > 0 && (
              // Counted, not linked: @elkdonis/messaging holds the
              // conversations but IFAC has no inbox route yet, and a button
              // that goes nowhere is worse than a number that is just true.
              <span className="hub-chip">no inbox here yet</span>
            )}
          </dd>
          <dt>Upcoming</dt>
          <dd>
            {summary.upcomingCount
              ? `${summary.upcomingCount} you're attending`
              : "Nothing on your calendar"}
          </dd>
          <dt>Bio</dt>
          <dd>{summary.bioLength ? "Written" : "Not written yet"}</dd>
          <dt>Gallery</dt>
          <dd>
            {summary.galleryCount
              ? `${summary.galleryCount} piece${summary.galleryCount === 1 ? "" : "s"}`
              : "Empty"}
          </dd>
        </dl>

        <div className="hub-panel-actions">
          {profileHref ? (
            <>
              <a
                className="hub-btn hub-btn--primary"
                href={`${profileHref}?edit=1`}
              >
                Edit my page
              </a>
              <a className="hub-btn" href={profileHref}>
                View my page
              </a>
            </>
          ) : (
            <p className="hub-muted">
              Your profile has no address yet, so it can't be opened. An owner
              or guide can set one.
            </p>
          )}
        </div>

        <h4 className="hub-panel-subhead">Sections on your page</h4>
        <label className="hub-toggle">
          <input
            type="checkbox"
            checked={feedOn}
            disabled={saving}
            onChange={(e) => void toggleFeed(e.target.checked)}
          />
          <span>
            <strong>Elkdonis blog feed</strong>
            <span className="hub-muted">
              Show the network's latest posts at the bottom of your page.
            </span>
          </span>
        </label>

        {sections.hasStore ? (
          <label className="hub-toggle">
            <input
              type="checkbox"
              checked={storeOn}
              disabled={saving}
              onChange={(e) => void toggleStore(e.target.checked)}
            />
            <span>
              <strong>My store</strong>
              <span className="hub-muted">
                Show your listed work from the network marketplace on your page.
                Buying happens there; manage listings in your{" "}
                <a href={`${market}/studio`}>studio</a>.
              </span>
            </span>
          </label>
        ) : (
          <p className="hub-muted">
            Members can sell on the network marketplace and show their work
            here.{" "}
            <a href={`${market}/studio/apply`}>Open a store</a>.
          </p>
        )}

        {error && (
          <p className="hub-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </HubCard>
  );
}
