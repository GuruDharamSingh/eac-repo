"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SurfaceProvider,
  defaultThreadToAnswers,
  type SurfaceConnectors,
  type SurfaceThread,
} from "@elkdonis/cms-ui/surface";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { saveContentAction } from "@/lib/cms/actions";
import { toContentFormValues } from "@/lib/cms/compose-adapter";
import { siteConfig } from "@/config/site";

/**
 * This site's connectors for the shared surface system.
 *
 * Every popup here — a piece of writing, an offering, the compose form — is
 * `@elkdonis/cms-ui/surface` rendered against these functions. The surfaces
 * never see this app's routes or column names; this file is the whole
 * translation, the same way compose-adapter.ts is the one translation between
 * the shared field vocabulary and this site's schema.
 *
 * Mounted once in the root layout, so a card on a public feed page opens the
 * same surface a hub tile does. Reads go through /api/hub/threads/[id], which
 * gates on the thread's own visibility; the save goes through the same server
 * action /manage uses, so a post written from the hub is exactly the post
 * /manage would make.
 *
 * Deliberately omitted, because this site does not have them: `listEvents`
 * (nothing here is scheduled — its threads carry no date columns), `rsvp`, and
 * `board`. Omitting a connector is how the shared surface hides a capability
 * rather than showing an empty one.
 */
export function HubSurfaces({
  signedIn,
  canEdit,
  displayName,
  feeds,
  children,
}: {
  signedIn: boolean;
  canEdit: boolean;
  displayName?: string | null;
  feeds: Array<{ slug: string; name: string }>;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      viewer: {
        signedIn,
        displayName: displayName ?? null,
        // `canCompose` is the boolean; `canEdit` is a per-thread predicate.
        // This site has one editor tier — an owner/guide may edit anything the
        // org owns — so the predicate is constant.
        canCompose: canEdit,
        canEdit: () => canEdit,
      },
      orgName: siteConfig.orgName,

      async loadThread(id) {
        const res = await fetch(`/api/hub/threads/${encodeURIComponent(id)}`);
        // The route 404s rather than 403s on purpose — an unpublished item
        // should not confirm it exists — so both mean "nothing to show".
        if (res.status === 404 || res.status === 403) return null;
        if (!res.ok) throw new Error(`loadThread ${res.status}`);
        return (await res.json()) as SurfaceThread;
      },

      async listMedia() {
        const res = await fetch("/api/media/library");
        if (!res.ok) return [];
        const body = await res.json();
        const raw: unknown[] = body.items ?? body.files ?? [];
        return raw
          .map((r) => r as Record<string, unknown>)
          .filter((r) => typeof r.url === "string")
          .map((r) => ({
            url: String(r.url),
            name: String(r.filename ?? r.name ?? r.url),
          }));
      },
      uploadEndpoint: "/api/upload",

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
          const res = await fetch("/api/forum/read-all", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ back: "/hub" }),
            redirect: "manual",
          });
          return res.ok || res.type === "opaqueredirect" || res.status === 303;
        },
      },

      compose: {
        orgSlug: siteConfig.orgId,
        feeds,
        canManageOrg: canEdit,
        canPublishContent: canEdit,
        // No network front page, no Talk room, no workshop programme: the
        // catalogue should not offer doors this site cannot open.
        canShareToNetwork: false,
        hasWorkshops: false,
        hasMeetings: false,
      },

      composeSlots: {
        body: ({ value, onChange }) => (
          <RichTextEditor value={value} onChange={onChange} />
        ),
        // Never a URL box: upload, or choose from what this org already has.
        media: ({ value, onChange }) => (
          <MediaPicker
            value={typeof value === "string" ? value : undefined}
            onChange={onChange}
            uploadEndpoint="/api/upload"
            libraryEndpoint="/api/media/library"
            label="Cover image"
            hint="Shown on listings and at the top of the page."
          />
        ),
      },

      threadToAnswers: defaultThreadToAnswers,

      async saveThread({ kind, answers, status, threadId }) {
        const result = await saveContentAction(
          toContentFormValues(kind, answers, status),
          threadId
        );
        if (!result.ok) {
          return {
            ok: false,
            error: "error" in result ? result.error : "Could not save it",
          };
        }
        router.refresh();
        // The surface needs the id to reopen what was just written, and the
        // href to offer "view it". The action already returns both.
        return {
          ok: true,
          id: String(result.id),
          href: "path" in result ? (result.path as string | null) : null,
        };
      },
    }),
    [signedIn, canEdit, displayName, feeds, router]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
