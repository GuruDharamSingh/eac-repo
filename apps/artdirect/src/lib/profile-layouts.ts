/**
 * Moved to @elkdonis/cms-ui/profile so arts-collective renders a person's
 * chosen layout the same way ArtDirect does — a layout id has to mean one
 * thing across the network, not one thing per app.
 *
 * Re-exported here so existing imports keep working.
 */
export {
  PROFILE_LAYOUTS,
  DEFAULT_PROFILE_LAYOUT,
  isKnownLayout,
  resolveLayout,
} from "@elkdonis/cms-ui/profile";
export type { ProfileLayoutOption } from "@elkdonis/cms-ui/profile";
