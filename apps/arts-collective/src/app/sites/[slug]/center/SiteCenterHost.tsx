"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceProvider, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";

/**
 * The surface stack under an org subdomain's /center.
 *
 * Same floor as NetworkCenterHost (the person's profile popup, Where you
 * show, Show on, "Post to…", connections — all served by this app's
 * /api/center/* routes, which the middleware leaves alone on every host),
 * plus this org's threads and calendar at /api/org/<slug>/…, so a feed row
 * or the pinned faces open in place. Nothing org-editorial: the console on
 * /hub/organization keeps compose, board and settings.
 */
export function SiteCenterHost({
  orgSlug,
  orgName,
  displayName,
  canCompose,
  timeZone,
  children,
}: {
  orgSlug: string;
  orgName: string;
  displayName: string | null;
  canCompose: boolean;
  timeZone?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const connectors = React.useMemo<SurfaceConnectors>(
    () =>
      createHubConnectors({
        viewer: { signedIn: true, canCompose, displayName },
        orgName,
        timeZone,
        routes: {
          thread: `/api/org/${encodeURIComponent(orgSlug)}/threads`,
          calendar: `/api/org/${encodeURIComponent(orgSlug)}/calendar`,
          mediaLibrary: "/api/media/library",
          upload: "/api/upload/image",
          rsvp: "/api/threads",
        },
        board: false,
        forum: false,
        documents: false,
        profile: true,
        presence: true,
        listings: true,
        postTo: true,
        connections: { startUrl: "/api/connections/start" },
        onMutated: () => router.refresh(),
      }),
    [orgSlug, orgName, displayName, canCompose, timeZone, router]
  );
  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
