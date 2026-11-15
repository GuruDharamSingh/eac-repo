"use client";

import * as React from "react";
import type { SiteFormSite } from "@elkdonis/site-forms";
import { meetingActions, sitePostActions, workshopActions } from "@elkdonis/studio-forms";
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
  siteWorkshopContextAction,
  siteWorkshopListAction,
  siteWorkshopLoadAction,
  siteWorkshopSaveAction,
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

// innergathering runs both reminder jobs: the attendee-reminder tick (instrumentation.ts -> lib/reminders.ts
// runAttendeeReminderTick every 5 minutes; DISABLE_REMINDER_SCHEDULER is unset in compose) and the one-shot
// "minimum reached" mail from api/threads/[id]/rsvp/route.ts (notify_on_min_attendees). Both switches are offered.
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
 * innergathering's binding for the shared forms (@elkdonis/site-forms): the compose popup
 * (components/hub/HubSurfaces.tsx, `compose:meeting|event|article`) and the page host
 * (components/manage/site-form-page.tsx), including `workshop`.
 */
export function innergatheringSiteForms(feeds: Array<{ slug: string; name: string }>): SiteFormSite {
  return {
    orgId: siteConfig.orgId,
    // inner_group is private by default: a new item starts members-only; the person's own pick is kept.
    defaultAudience: "members",
    meetingOptions: { cycleBadge: true },
    orgName: siteConfig.orgName,
    timeZone: siteConfig.timeZone,
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
      workshop: {
        actions: workshopActions({
          context: siteWorkshopContextAction,
          loadWorkshop: siteWorkshopLoadAction,
          saveWorkshop: siteWorkshopSaveAction,
          listWorkshops: siteWorkshopListAction,
        }),
      },
    },
  };
}
