"use client";

import * as React from "react";
import { SurfaceProvider, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { defineTermAction, lookupTermAction } from "@/lib/dictionary-actions";

/**
 * The surface stack for the wiki, carrying one connector: the dictionary.
 *
 * Without a provider above it the editor's "Define" affordance hides itself
 * (`useSurfaceOptional()` returns null), which meant the wiki — the one place
 * whose entire subject is defined terms — was the one place you could not
 * define one. Terms could only be added from a compose popup on another app.
 *
 * Deliberately minimal. `viewer` and `loadThread` are the only required
 * connectors; every other surface is left unwired because none is reachable
 * from here. Nothing on the wiki pushes a thread surface — wikilinks navigate
 * to wiki routes rather than opening threads — so loadThread answering null
 * is the honest shape, not a stub standing in for missing work.
 */
export function WikiSurfaceHost({
  signedIn,
  displayName,
  children,
}: {
  signedIn: boolean;
  displayName?: string | null;
  children: React.ReactNode;
}) {
  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      viewer: { signedIn, canCompose: signedIn, displayName },

      // No thread surfaces are reachable from the wiki. See above.
      async loadThread() {
        return null;
      },

      dictionary: {
        lookup: (term) => lookupTermAction(term),
        define: (input) => defineTermAction(input),
      },
    }),
    [signedIn, displayName]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
