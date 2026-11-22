"use client";

import * as React from "react";
import type { SiteFormSite } from "@elkdonis/site-forms";
import { meetingActions, seriesCreateActions, sitePostActions } from "@elkdonis/studio-forms";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { siteConfig } from "@/config/site";
import { siteMeetingContextAction, siteMeetingLoadAction, siteMeetingSaveAction } from "@/lib/forms/meeting-actions";
import { siteEventContextAction, siteEventLoadAction, siteEventSaveAction } from "@/lib/forms/event-actions";
import { sitePostContextAction, sitePostListAction, sitePostLoadAction, sitePostSaveAction } from "@/lib/forms/post-actions";
import { siteSeriesContextAction, siteSeriesCreateAction } from "@/lib/forms/series-actions";

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_ORIGIN = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;


// Materials upload: the site's own /api/upload (media row id, attached on save by services attachMaterials).
async function uploadMaterial(file: File): Promise<{ ok: true; item: { id: string; url: string; filename: string; mimeType: string; size: number } } | { ok: false; error: string }> {
  try {
    const body = new FormData();
    body.append("file", file);
    body.append("visibility", "PUBLIC");
    const res = await fetch("/api/upload", { method: "POST", body });
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
 * Para Theater's binding for the shared forms (@elkdonis/site-forms), used by the compose popup
 * (components/hub/HubSurfaces.tsx, `compose:meeting`) and the page host (components/manage/meeting-form-page.tsx).
 */
export function sunjaySiteForms(feeds: Array<{ slug: string; name: string }>): SiteFormSite {
  return {
    orgId: siteConfig.orgId,
    orgName: siteConfig.orgName,
    timeZone: "America/Toronto",
    // The forms follow the site's own surface tokens and fonts (site-look.css; pins in globals.css).
    look: "site",
    feeds,
    network: { origin: NETWORK_ORIGIN, carry: (url) => `/api/auth/handoff?to=${encodeURIComponent(url)}` },
    materials: { upload: uploadMaterial },
    slots: {
      media: ({ value, onChange, label, hint, accept }) => (
        <MediaPicker
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          uploadEndpoint="/api/upload"
          libraryEndpoint="/api/media/library"
          label={label ?? "Image"}
          hint={hint}
          accept={accept}
        />
      ),
      body: ({ value, onChange, tier }) => <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />,
    },
    kinds: {
      post: {
        actions: sitePostActions({
          context: sitePostContextAction,
          loadPost: sitePostLoadAction,
          savePost: sitePostSaveAction,
          listPosts: sitePostListAction,
        }),
      },
      event: {
        actions: meetingActions(
          {
            context: siteEventContextAction,
            loadMeeting: siteEventLoadAction,
            saveMeeting: siteEventSaveAction,
            listMeetings: async () => [],
            removeMeeting: async () => ({ ok: false, error: "Remove an event from /manage." }),
          },
          { kind: "event", canRemind: () => true, canNotifyMin: () => true }
        ),
      },
      series: {
        // Create only: a made series opens in the planner (/hub/series/<id>).
        actions: seriesCreateActions({ context: siteSeriesContextAction, createSeries: siteSeriesCreateAction }, { timeZone: siteConfig.timeZone }),
      },
      meeting: {
        // Para Theater runs the attendee-reminder tick (lib/reminders.ts, instrumentation.ts) and mails
        // "minimum reached" from its RSVP route (api/threads/[id]/rsvp/route.ts).
        actions: meetingActions(
          {
            context: siteMeetingContextAction,
            loadMeeting: siteMeetingLoadAction,
            saveMeeting: siteMeetingSaveAction,
            // Not used by the form: the list and removal stay on /manage.
            listMeetings: async () => [],
            removeMeeting: async () => ({ ok: false, error: "Remove a meeting from /manage." }),
          },
          { canRemind: () => true, canNotifyMin: () => true }
        ),
      },
    },
  };
}
