/**
 * Silex editor door switch. Justin, 2026-11-20: "hide [the] Silex door for now".
 * A plain constant (not an env var) so client components can import it with no
 * NEXT_PUBLIC build-time plumbing. Flip to true to restore every launcher.
 * Only launch UI and /edit/<slug> are gated; api/silex/* and rendering of
 * published Silex sites are untouched.
 */
export const SILEX_EDITOR_ENABLED = false;
