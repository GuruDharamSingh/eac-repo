"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceProvider, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";

/**
 * The network tab's surface stack: the person's side of /center, on the hub.
 *
 * Only the three person-level capabilities — the profile popup (with Where
 * you show) and "Post to…" — served by this app's /api/center/* routes. The
 * org console (Organization tab) keeps its own provider; this one knows no
 * org, which is the point of the network tab. Brief A slice 4.
 */
export function NetworkCenterHost({
  displayName,
  children,
}: {
  displayName: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const connectors = React.useMemo<SurfaceConnectors>(
    () =>
      createHubConnectors({
        viewer: { signedIn: true, canCompose: false, displayName },
        orgName: "Elkdonis Arts Collective",
        timeZone: "America/Toronto",
        profile: true,
        presence: true,
        postTo: true,
        onMutated: () => router.refresh(),
      }),
    [displayName, router]
  );
  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
