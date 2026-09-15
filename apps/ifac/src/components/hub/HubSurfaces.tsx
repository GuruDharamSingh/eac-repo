"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceProvider, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import { siteConfig } from "@/config/site";
import { FilesSurface } from "./FilesCard";
import { PageSectionsSurface } from "./PageSectionsCard";
import { HelpSurface, QuestionnairesSurface } from "./wide-surfaces";

/**
 * IFAC's connectors for the shared surface system.
 *
 * This site predates the surface system and grew its own popup idiom — a
 * `HubCard` wrapping a native <dialog>, one of the four idioms the shared
 * system was built to replace. Mounting the provider here does not remove
 * that: both work side by side, so the hub's tiles move onto faces one at a
 * time instead of in a single risky sweep.
 *
 * The routine half comes from `createHubConnectors`. What is stated here is
 * only what is true of THIS site:
 *
 *   board   — IFAC already serves the whole /api/pipeline/cards/* Deck API,
 *             so the shared board surface works against the default routes.
 *   forum   — /api/hub/forum, added beside this file.
 *   rsvp    — overridden: IFAC takes {threadId,status} on one POST, not the
 *             POST/DELETE on /api/threads/:id/rsvp the template apps use.
 *
 * `loadThread` uses the factory default against /api/hub/threads/[id], which
 * this site had no equivalent of until now — it is a prerequisite rather than
 * a nicety, because a calendar day with one thing on it opens that thing.
 *
 * Deliberately NOT claimed:
 *   profile / centerLayout — the /api/center/* routes do not exist here yet.
 *   compose                — this site's authoring lives at /hub/compose and
 *                            in its questionnaire workspace, not in the
 *                            shared compose surface.
 */
export function HubSurfaces({
  signedIn,
  canEdit,
  displayName,
  children,
}: {
  signedIn: boolean;
  canEdit: boolean;
  displayName?: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const connectors = React.useMemo<SurfaceConnectors>(
    () =>
      createHubConnectors({
        viewer: { signedIn, canCompose: false, displayName },
        orgName: siteConfig.orgName,
        timeZone: "America/Toronto",
        board: true,
        forum: true,
        // Ideas and documents moved onto the shared surfaces. They were built
        // here first and were the only real ones in the repo; what was local
        // about them was the routes, which `createHubConnectors` now addresses
        // by the same paths this site already served.
        documents: true,
        ideas: { href: "/forum/ideas" },
        // Identity — name, portrait, bio, links — is the shared `profile`
        // surface type (not `custom`): the same `users` row every org site
        // edits, read and written through /api/center/profile and
        // /api/center/avatar, which this app now serves the same way
        // amrit-canada and innergathering do.
        profile: true,
        onMutated: () => router.refresh(),

        // This site's own features, which have no shared surface: they are
        // real here and nowhere else. Registered as `custom`, which trades
        // URL-addressability for not having to invent a network-wide
        // descriptor for one org's filing cabinet.
        custom: {
          files: ({ descriptor }) => <FilesSurface descriptor={descriptor} />,
          "page-sections": ({ descriptor }) => (
            <PageSectionsSurface descriptor={descriptor} />
          ),
          questionnaires: ({ descriptor }) => (
            <QuestionnairesSurface descriptor={descriptor} />
          ),
          help: () => <HelpSurface />,
        },

        // One POST carries both directions here.
        async rsvp(thread, going) {
          const res = await fetch("/api/hub/rsvp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threadId: thread.id, status: going ? "yes" : "no" }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false, error: data.error ?? "Could not update your RSVP." };
          return { ok: true, attending: Boolean(data.attending ?? going), count: data.count };
        },
      }),
    [signedIn, canEdit, displayName, router]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
