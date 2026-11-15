"use client";

import * as React from "react";
import type { SiteFormSite } from "@elkdonis/site-forms";
import { meetingActions, sitePostActions } from "@elkdonis/studio-forms";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
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

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_ORIGIN = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

const meetingServer = {
  context: siteMeetingContextAction,
  loadMeeting: siteMeetingLoadAction,
  saveMeeting: siteMeetingSaveAction,
  // Not used by the form: the list and removal stay on /manage.
  listMeetings: async () => [],
  removeMeeting: async () => ({ ok: false as const, error: "Remove a meeting from /manage." }),
};

// amrit-canada runs the attendee-reminder tick (instrumentation.ts -> lib/reminders.ts, every 5 minutes;
// DISABLE_REMINDER_SCHEDULER is unset in compose) and mails "minimum reached" from its RSVP route
// (api/threads/[id]/rsvp/route.ts, notify_on_min_attendees). Both switches are therefore offered.
const reminders = { canRemind: () => true, canNotifyMin: () => true };


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
 * amrit-canada's binding for the shared forms (@elkdonis/site-forms), used by the compose popup
 * (components/hub/HubSurfaces.tsx, `compose:meeting|event|post`) and the page host
 * (components/manage/site-form-page.tsx).
 */
export function amritSiteForms(feeds: Array<{ slug: string; name: string }>): SiteFormSite {
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
    },
  };
}
