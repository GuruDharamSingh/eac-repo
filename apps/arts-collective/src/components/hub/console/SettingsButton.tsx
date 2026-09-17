"use client";

import { useSurface } from "@elkdonis/cms-ui/surface";
import { CONSOLE_SURFACES } from "./AttentionBands";

/**
 * The one way into configuration.
 *
 * Identity, roles, appearance and the site address used to be four inline
 * sections competing with publishing for the page. They are now one surface
 * behind this button, which is where a console puts the things you change
 * twice a year.
 */
export function SettingsButton({ section }: { section?: string }) {
  const surface = useSurface();
  return (
    <button
      type="button"
      onClick={(e) =>
        surface.open(
          {
            type: "custom",
            key: CONSOLE_SURFACES.settings,
            title: "Settings",
            size: "wide",
            ...(section ? { props: { section } } : {}),
          },
          e.currentTarget
        )
      }
      className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-accent"
    >
      Settings
    </button>
  );
}
