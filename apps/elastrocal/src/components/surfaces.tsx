"use client";

import { SurfaceProvider } from "@elkdonis/cms-ui/surface";
import "@elkdonis/cms-ui/surface.css";
import "@elkdonis/sky-ui/sky.css";
import { withBase } from "@/lib/base-path";
import { SkySurface } from "@/components/sky";

/**
 * The app's one popup, mounted in the root layout.
 *
 * Elastrocal has no `threads` yet, so the shared surfaces that read them
 * (compose, calendar, gallery, board, forum) are all off — a connector left
 * out disables its surface. What it registers is its own: `custom.sky`, the
 * current sky, which any face opens with `{ type: "custom", key: "sky" }`.
 */
export function Surfaces({ children, signedIn }: { children: React.ReactNode; signedIn: boolean }) {
  return (
    <SurfaceProvider
      connectors={{
        viewer: { signedIn, canCompose: false },
        // Nothing here has threads to load; the sky surface never asks.
        loadThread: async () => null,
        orgName: "Elastrocal",
        custom: { sky: () => <SkySurface siteUrl={withBase("/")} /> },
      }}
    >
      {children}
    </SurfaceProvider>
  );
}
