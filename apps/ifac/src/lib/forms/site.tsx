"use client";

import * as React from "react";
import type { SiteFormSite } from "@elkdonis/site-forms";
import { meetingActions, seriesCreateActions, sitePostActions } from "@elkdonis/studio-forms";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { DEFAULT_SERIES_ZONE } from "@/lib/series-time";
import { siteConfig } from "@/config/site";
import {
  siteMeetingContextAction,
  siteMeetingLoadAction,
  siteMeetingSaveAction,
  sitePostContextAction,
  sitePostListAction,
  sitePostLoadAction,
  sitePostSaveAction,
} from "@/lib/forms/meeting-actions";
import { siteSeriesContextAction, siteSeriesCreateAction } from "@/lib/forms/series-actions";

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_ORIGIN = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

const meetingServer = {
  context: siteMeetingContextAction,
  loadMeeting: siteMeetingLoadAction,
  saveMeeting: siteMeetingSaveAction,
  // Not used by the form: lists and removal stay in the hub.
  listMeetings: async () => [],
  removeMeeting: async () => ({ ok: false as const, error: "Remove a meeting from the hub." }),
};

// IFAC's reminder tick (instrumentation.ts -> lib/reminders.ts = series-site createSeriesReminders) mails
// series sessions and rota hosts only; it does not read a standalone meeting's `reminder_minutes_before`.
// IFAC's RSVP route (api/hub/rsvp) does not mail "minimum reached". Neither switch is offered (2026-11-14).
const reminders = { canRemind: () => false, canNotifyMin: () => false };


// Materials upload: the site's own /api/upload (media row id, attached on save by services attachMaterials).
async function uploadMaterial(file: File): Promise<{ ok: true; item: { id: string; url: string; filename: string; mimeType: string; size: number } } | { ok: false; error: string }> {
  try {
    const body = new FormData();
    body.append("file", file);
    body.append("visibility", "PUBLIC");
    const res = await fetch("/api/media/upload", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url || !data.id) return { ok: false, error: data.error ?? "Upload failed." };
    return {
      ok: true,
      item: { id: data.id, url: data.url, filename: data.filename ?? data.name ?? file.name, mimeType: data.mimeType ?? file.type, size: data.size ?? file.size },
    };
  } catch {
    return { ok: false, error: "Upload failed: could not reach the server." };
  }
}

/**
 * IFAC's binding for the shared forms (@elkdonis/site-forms), used by the compose popup
 * (components/hub/HubSurfaces.tsx, `compose:meeting|event|article|series`) and the /hub/compose page
 * (components/hub/compose-workspace.tsx).
 */
export function ifacSiteForms(feeds: Array<{ slug: string; name: string }>): SiteFormSite {
  return {
    orgId: siteConfig.orgId,
    orgName: siteConfig.orgName,
    timeZone: "America/Toronto",
    feeds,
    network: { origin: NETWORK_ORIGIN, carry: (url) => `/api/auth/handoff?to=${encodeURIComponent(url)}` },
    materials: { upload: uploadMaterial },
    slots: {
      media: ({ value, onChange, label, hint, accept }) => (
        <MediaPicker
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          // The org's own media tree; `/api/upload` is the artist portfolio route and wants a memberSlug.
          uploadEndpoint="/api/media/upload"
          libraryEndpoint="/api/media/library"
          label={label ?? "Image"}
          hint={hint}
          accept={accept}
        />
      ),
      body: ({ value, onChange, tier }) => <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />,
    },
    kinds: {
      meeting: { actions: meetingActions(meetingServer, { ...reminders, kind: "meeting" }) },
      event: { actions: meetingActions(meetingServer, { ...reminders, kind: "event" }) },
      post: {
        actions: sitePostActions({
          context: sitePostContextAction,
          loadPost: sitePostLoadAction,
          savePost: sitePostSaveAction,
          listPosts: sitePostListAction,
        }),
      },
      // Create only: a made series opens in the planner (/hub/series/<id>).
      series: { actions: seriesCreateActions({ context: siteSeriesContextAction, createSeries: siteSeriesCreateAction }, { timeZone: DEFAULT_SERIES_ZONE }) },
    },
  };
}
