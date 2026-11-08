"use client";

import type { SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { STUDIO_SURFACE, StudioComposeSurface } from "./studio-surface";
import { CHOOSER_SURFACE, PublishChooser } from "./publish-door";

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;

/**
 * Round 4's custom surfaces, for HubSurfaces' `custom` connectors (one spread there):
 * the Publish chooser and the Studio popup.
 */
export function publishSurfaces(feeds: Array<{ slug: string; name: string }>) {
  return {
    [CHOOSER_SURFACE]: () => <PublishChooser feeds={feeds} />,
    [STUDIO_SURFACE]: ({ descriptor }: { descriptor: Custom }) => <StudioComposeSurface descriptor={descriptor} />,
  };
}
