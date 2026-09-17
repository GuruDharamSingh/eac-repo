"use client";

import * as React from "react";
import { SurfaceCard, useSurface } from "../surface";
import { faceOf } from "../hub/face-origin";
import type { EmailSuiteData } from "./types";

// ============================================================================
// "Email", as a face.
//
// It draws the org's actual correspondence — the last few letters out and the
// last few in — rather than describing the feature, on the same principle as
// DocumentsFace and IdentitiesFace: a tile reading "Email · send confirmations
// and reminders" names a noun; a tile showing that four people were mailed on
// Tuesday and one of them wrote back tells you what your organisation's email
// has been DOING.
//
// That is a change of subject from what was here before. The previous face
// (apps/amrit-canada/src/components/hub/EmailFace.tsx) offered a thread picker
// and three verbs, which made email a thing you configure. Email is mostly a
// thing that happens to you, so the face leads with what happened.
//
// HEADER-LED, because this face is read top-down and then used: the unread
// count and the compose buttons are the point, not glance-value.
//
// The live region carries the two controls a person actually reaches for — the
// unread badge, and a row of letter kinds. Everything else is one click deeper.
// ============================================================================

/** A mark per kind of arrival, so the feed is scannable without reading it. */
function directionGlyph(direction: "sent" | "received", kind: string): string {
  if (direction === "sent") return "↗";
  if (kind === "bounce") return "⚠";
  if (kind === "auto") return "◌";
  return "↙";
}

/** "3h", "2d" — an activity feed is read for recency, not for timestamps. */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export interface EmailFaceProps {
  data: EmailSuiteData;
  /** Hidden from anyone who cannot send in the org's name. */
  canEdit?: boolean;
}

export function EmailFace({ data, canEdit = true }: EmailFaceProps) {
  const surfaces = useSurface();
  const recent = data.activity.slice(0, 4);

  const open = (tab: string, origin: HTMLElement | null) =>
    surfaces.open(
      { type: "custom", key: "email", title: "Email", kind: "neutral", size: "wide", props: { tab } },
      origin
    );

  // The blurb is the one sentence a member gets instead of the whole suite:
  // what is waiting, or — when nothing is — what this thing is for.
  const blurb = data.unread
    ? `${data.unread} waiting for an answer.`
    : data.activity.length
      ? `${data.stats.sent} sent · ${data.addresses.filter((a) => a.mailable).length} on the list`
      : "Letters this organisation sends, and the replies that come back.";

  return (
    <SurfaceCard
      kind="neutral"
      glyph="✉"
      kicker="Email"
      layout="header"
      title={data.identity.fromName}
      blurb={blurb}
      ariaLabel="Open this organisation's email"
      onClick={(origin) => open("activity", origin)}
      tools={
        data.unread ? (
          <button
            type="button"
            className="eac-email-badge"
            onClick={(e) => open("inbox", faceOf(e.currentTarget))}
          >
            {data.unread} unread
          </button>
        ) : undefined
      }
      preview={
        <div className="eac-face-live eac-email-face">
          {recent.length > 0 ? (
            <ul className="eac-email-feed">
              {recent.map((row) => (
                <li key={`${row.direction}-${row.id}`} className="eac-email-feed-row">
                  <span
                    className={`eac-email-mark eac-email-mark--${row.direction}`}
                    aria-hidden
                  >
                    {directionGlyph(row.direction, row.kind)}
                  </span>
                  <span className="eac-email-feed-text">
                    <span className="eac-email-feed-subject">
                      {row.subject || row.kind}
                    </span>
                    {/* The screen-reader sentence, because the glyph above is
                        decorative and "↗ 4 recipients" is not a sentence. */}
                    <span className="eac-email-feed-who">
                      <span className="eac-sr-only">
                        {row.direction === "sent" ? "Sent to " : "Received from "}
                      </span>
                      {row.who}
                    </span>
                  </span>
                  <span className="eac-email-feed-when">{ago(row.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="eac-email-quiet">
              Nothing sent or received yet.
            </p>
          )}

          {canEdit && (
            <div className="eac-email-actions">
              <button
                type="button"
                className="eac-email-chip"
                onClick={(e) => open("inbox", faceOf(e.currentTarget))}
              >
                Inbox
              </button>
              <button
                type="button"
                className="eac-email-chip"
                onClick={(e) => open("addresses", faceOf(e.currentTarget))}
              >
                Address book
              </button>
              <button
                type="button"
                className="eac-email-chip"
                onClick={(e) => open("letters", faceOf(e.currentTarget))}
              >
                Letters
              </button>
              {/* A link and not a button: the suite is a page, and a person
                  should be able to open it in a new tab or bookmark it. */}
              <a className="eac-email-chip eac-email-chip--go" href={data.suiteHref}>
                Go to the email suite →
              </a>
            </div>
          )}
        </div>
      }
    />
  );
}
