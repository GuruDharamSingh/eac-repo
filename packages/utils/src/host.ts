// ============================================================================
// @elkdonis/utils/host: what every host-mounted shared UI asks its host for
// (2026-11-08). Types only: no React, no runtime, no route.
//
// Shared by the publication forms (`@elkdonis/studio/forms` FormHost) and the
// hub cards (`@elkdonis/hub` HubCardHost); both extend HostLinks rather than
// declaring their own. Plans: docs/open/publishing-forms-handoff/PLAN.md §3,
// docs/open/hub-cards-handoff/PLAN.md §1.2–1.3.
//
// Nothing shared may hard-code a path. On katie, elktours, sunjay and
// hidden-enneagram `/studio` is the Puck page editor, and hidden-enneagram
// mounts the authoring Studio at `/publish`; per-app /manage and /hub trees
// differ too (the architect's org_sites.manage_paths).
// ============================================================================

/** What a Studio link is asked for. A superset of @elkdonis/content's StudioHrefRequest. */
export interface StudioLinkRequest {
  /** The shared kind ("post", "gathering", "meeting", "artwork", …); the host maps it to its own `?kind=`. */
  kind: string;
  /** The Studio's own `?kind=`, when the caller already knows it (content's CREATE_KINDS). */
  studioKind?: string | null;
  id?: string;
  org?: string | null;
  focus?: boolean;
  preset?: string;
  /** Content-doc hand-off: `thread:<id>` / `artwork:<id>` and a Channel delivery id. */
  about?: string;
  delivery?: string;
  /** Where to come back to afterwards. */
  next?: string;
}

/** An item a link can point at. */
export interface HostItemRef {
  kind: string;
  id: string;
  slug?: string | null;
}

/** Link builders. Functions, so a server page passes the host from a client module. */
export interface HostLinks {
  /** The authoring Studio on this host. */
  studioHref(o: StudioLinkRequest): string;
  /** An item's public page; null when it has none on this host. */
  viewHref?(ref: HostItemRef): string | null;
  /** A management screen by its logical name ("pages", "people", "content"); null when this host lacks it. */
  manageHref?(screen: string): string | null;
  /** Sign in and come back. */
  loginHref?(next: string): string;
  /**
   * Paths that belong to the Studio on this host, for a framed surface's
   * navigation check (a frame that loads anything else closes and navigates
   * the parent). Defaults to the path of studioHref({kind:""}) plus /login.
   */
  studioPaths?: string[];
}

/**
 * A theme's icon set: each shared UI declares its own name union and asks
 * for icons by name, never a library. `C` is the host's component type
 * (React.ComponentType<{ size?: number; className?: string }> in practice),
 * left generic so this file stays React-free.
 */
export type IconMap<N extends string, C = unknown> = Record<N, C>;

/** Icon names the shared UIs have in common, so one theme map can serve the forms and the hub cards. */
export type CommonIconName =
  | 'back' | 'close' | 'plus' | 'minus' | 'caret' | 'check' | 'copy' | 'external' | 'expand' | 'more'
  | 'done' | 'empty' | 'error' | 'warning' | 'spinner' | 'person' | 'list' | 'image' | 'upload'
  | 'library' | 'camera' | 'link' | 'public' | 'members' | 'date' | 'clock' | 'preview' | 'previewOff';
