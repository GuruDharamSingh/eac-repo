"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SurfaceProvider,
  defaultThreadToAnswers,
  type SurfaceConnectors,
  type SurfaceThread,
  type SurfaceProfile,
  type SurfaceCenterLayout,
} from "@elkdonis/cms-ui/surface";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { saveContentAction } from "@/lib/cms/actions";
import { defineTermAction, lookupTermAction } from "@/lib/dictionary-actions";
import { toContentFormValues } from "@/lib/cms/compose-adapter";
import { siteConfig } from "@/config/site";

/** The Deck card JSON the pipeline API returns, as far as the board surface reads it. */
interface DeckCardJson {
  id: number;
  stackId: number;
  title: string;
  description?: string | null;
  duedate?: string | null;
  done?: string | null;
  archived?: boolean;
  labels?: Array<{ id: number; title: string; color: string }> | null;
  assignedUsers?: Array<{ participant?: { uid?: string; displayname?: string } }> | null;
  commentsCount?: number;
  attachmentCount?: number;
}

/**
 * This site's connectors for the shared surface system.
 *
 * Every popup on the site — a meeting, the month, the gallery, the quick-add
 * form, the writing room — is `@elkdonis/cms-ui/surface` rendered against
 * these functions. The surfaces never see this app's routes or column names;
 * this file is the whole translation, in one place, the same way
 * compose-adapter.ts is the one translation between the shared field
 * vocabulary and this site's schema.
 *
 * Mounted once, in the root layout, so a listing card on a public feed page
 * opens the same surface a hub tile does. Reads go through the hub API route
 * (public for published public threads, members for the rest, editors for
 * drafts); the save goes through the same server action /manage uses, so a
 * meeting made from a calendar day is exactly the meeting /manage would make.
 */
export function HubSurfaces({
  signedIn,
  canEdit,
  displayName,
  feeds,
  talkBaseUrl,
  children,
}: {
  signedIn: boolean;
  canEdit: boolean;
  displayName?: string | null;
  feeds: Array<{ slug: string; name: string }>;
  talkBaseUrl: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      viewer: { signedIn, canCompose: canEdit, displayName },
      orgName: siteConfig.orgName,
      timeZone: "America/Toronto",
      talkBaseUrl,
      // The published page renders posts in the journal voice; the writing
      // room's preview should match it.
      readingVoice: "journal",

      async loadThread(id) {
        const res = await fetch(`/api/hub/threads/${encodeURIComponent(id)}`);
        if (res.status === 404 || res.status === 403) return null;
        if (!res.ok) throw new Error(`loadThread ${res.status}`);
        return (await res.json()) as SurfaceThread;
      },

      async listEvents(from, to) {
        const res = await fetch(
          `/api/hub/calendar?from=${from.toISOString()}&to=${to.toISOString()}`
        );
        if (!res.ok) throw new Error(`listEvents ${res.status}`);
        return (await res.json()).events ?? [];
      },

      // The library route is editors-only (it lists unpublished material), so
      // the gallery face is only offered to editors — see hub/page.tsx.
      async listMedia() {
        const res = await fetch("/api/media/library");
        if (!res.ok) throw new Error(`listMedia ${res.status}`);
        const data = await res.json();
        return (data.items ?? []).map((i: { url: string; filename: string }) => ({
          url: i.url,
          name: i.filename,
        }));
      },
      uploadEndpoint: "/api/upload",

      // Arranging the center: an org's definition over the network default.
      centerLayout: {
        async load(orgId) {
          const res = await fetch(`/api/center/layout?org=${encodeURIComponent(orgId)}`);
          if (res.status === 404 || res.status === 401) return null;
          if (!res.ok) throw new Error(`centerLayout ${res.status}`);
          return (await res.json()) as SurfaceCenterLayout;
        },
        async save(orgId, layout) {
          const res = await fetch(`/api/center/layout?org=${encodeURIComponent(orgId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(layout),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false, error: data.error ?? "Could not save that." };
          return { ok: true };
        },
      },
      // The profile surface: the person's network-wide identity, or this
      // org's own identity row for its owners and guides (the display image
      // lives there). Reads and writes go to /api/center/profile.
      profile: {
        async load(target) {
          const q = target ? `?org=${encodeURIComponent(target.orgId)}` : "";
          const res = await fetch(`/api/center/profile${q}`);
          if (res.status === 404 || res.status === 401) return null;
          if (!res.ok) throw new Error(`profile ${res.status}`);
          return (await res.json()) as SurfaceProfile;
        },
        async save(target, input) {
          const q = target ? `?org=${encodeURIComponent(target.orgId)}` : "";
          const res = await fetch(`/api/center/profile${q}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false, error: data.error ?? "Could not save that." };
          return { ok: true };
        },
        async uploadAvatar(file) {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch("/api/center/avatar", { method: "POST", body });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.url) return { ok: false, error: data.error ?? "Could not upload that." };
          return { ok: true, url: data.url as string };
        },
      },

      async rsvp(thread, going) {
        const res = await fetch(`/api/threads/${thread.id}/rsvp`, {
          method: going ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: going ? JSON.stringify({ receiveEmailNotice: true }) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Could not update your RSVP." };
        return { ok: true, attending: Boolean(data.attending), count: data.count };
      },

      async saveThread({ kind, answers, status, threadId }) {
        // This site's schema knows two shapes: writing, and a gathering. An
        // "event" from the shared catalogue is a gathering here.
        const siteKind = kind === "post" ? "post" : "meeting";
        const result = await saveContentAction(
          toContentFormValues(siteKind, answers, status),
          threadId
        );
        if (!result.ok || !result.id) {
          return { ok: false, error: result.error ?? "Could not save it" };
        }
        return { ok: true, id: result.id, href: result.path ?? null };
      },

      // The pipeline, as the shared board surface. Nextcloud Deck's shapes are
      // translated here; the surfaces read only SurfaceBoard.
      board: {
        async load() {
          const res = await fetch("/api/pipeline");
          if (res.status === 404) return null;
          if (!res.ok) throw new Error(`board ${res.status}`);
          const b = await res.json();
          if (!b) return null;
          return {
            title: b.title ?? "Pipeline",
            canWrite: signedIn,
            pageHref: "/hub/pipeline",
            stacks: (b.stacks ?? []).map((s: { id: number; title: string; cards?: DeckCardJson[] }) => ({
              id: s.id,
              title: s.title,
              cards: (s.cards ?? [])
                .filter((c) => !c.archived)
                .map((c) => ({
                  id: c.id,
                  stackId: c.stackId,
                  title: c.title,
                  description: c.description ?? null,
                  dueAt: c.duedate ?? null,
                  done: Boolean(c.done),
                  labels: (c.labels ?? []).map((l) => ({ id: l.id, title: l.title, color: l.color })),
                  assignees: (c.assignedUsers ?? []).map((a) => a.participant?.displayname ?? a.participant?.uid ?? ""),
                  commentsCount: c.commentsCount ?? 0,
                  attachmentCount: c.attachmentCount ?? 0,
                })),
            })),
          };
        },
        async createCard(stackId, title) {
          const res = await fetch("/api/pipeline/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stackId, title }),
          });
          if (!res.ok) return null;
          const c = (await res.json()) as DeckCardJson;
          return { id: c.id, stackId: c.stackId, title: c.title, description: c.description ?? null, dueAt: c.duedate ?? null, done: Boolean(c.done) };
        },
        async updateCard(cardId, patch) {
          const res = await fetch(`/api/pipeline/cards/${cardId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: patch.title, description: patch.description, duedate: patch.dueAt ?? null }),
          });
          return res.ok;
        },
        async setDone(cardId, done) {
          const res = await fetch(`/api/pipeline/cards/${cardId}/state`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done }),
          });
          return res.ok;
        },
        async moveCard(cardId, toStackId) {
          const res = await fetch(`/api/pipeline/cards/${cardId}/reorder`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toStackId, order: 0 }),
          });
          return res.ok;
        },
        async listComments(cardId) {
          const res = await fetch(`/api/pipeline/cards/${cardId}/comments`);
          if (!res.ok) return [];
          const rows = (await res.json()) as Array<{ id: number; message: string; actorDisplayName?: string; author?: string; creationDateTime?: string; at?: string }>;
          return rows.map((r) => ({ id: r.id, message: r.message, author: r.actorDisplayName ?? r.author ?? "Someone", at: r.creationDateTime ?? r.at ?? new Date().toISOString() }));
        },
        async addComment(cardId, message) {
          const res = await fetch(`/api/pipeline/cards/${cardId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
          });
          return res.ok;
        },
      },

      // The network dictionary. Defining a term while writing creates its
      // wiki page straight away — the wiki is shared across every org, so the
      // entry outlives whatever article prompted it.
      dictionary: {
        lookup: (term) => lookupTermAction(term),
        define: (input) => defineTermAction(input),
      },

      // The forum, as the shared forum surface. The tile is server-rendered
      // from the same snapshot in hub/page.tsx; this reload is what lets
      // "Mark all read" take effect without a page load.
      forum: {
        async load() {
          const res = await fetch("/api/hub/forum");
          if (!res.ok) throw new Error(`forum ${res.status}`);
          return await res.json();
        },
        async markAllRead() {
          // The board's own form action, posted from here. It answers with a
          // 303 back to the page a form came from; we only need whether it took.
          const body = new URLSearchParams({ back: "/hub" });
          const res = await fetch("/api/forum/read-all", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
            redirect: "manual",
          });
          return res.ok || res.type === "opaqueredirect" || res.status === 303;
        },
      },

      compose: {
        orgSlug: siteConfig.orgId,
        feeds,
        canManageOrg: canEdit,
        hasWorkshops: false,
        hasMeetings: true,
        canCreateDocument: true,
        canCreateTalkRoom: true,
        canShareToNetwork: false,
        defaultTimeZone: "America/Toronto",
      },

      composeSlots: {
        body: ({ value, onChange, tier }) => <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />,
        // Never a URL box: upload, or choose from what this org already has.
        media: ({ value, onChange, label, hint }) => (
          <MediaPicker
            value={typeof value === "string" ? value : undefined}
            onChange={onChange}
            uploadEndpoint="/api/upload"
            libraryEndpoint="/api/media/library"
            label={label ?? "Image"}
            hint={hint}
          />
        ),
      },

      // The shared mapper already carries recurrence, RSVP deadline, minimum
      // attendance and the time zone (through `extra`); this only adds `kind`.
      threadToAnswers(thread) {
        return {
          ...defaultThreadToAnswers(thread, { timeZone: thread.extra?.time_zone as string | undefined ?? "America/Toronto" }),
          kind: thread.kind,
        };
      },

      onMutated: () => router.refresh(),
    }),
    [signedIn, canEdit, displayName, feeds, talkBaseUrl, router]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
