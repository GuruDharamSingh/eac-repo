import type { HubCardHost } from '../contract';

/**
 * What the Site Builder card needs from its host. Everything it uses is already optional on the shared host:
 * `puckEditHref(path)`, `themeEditorHref(pageKey?)`, `uploadImage(file, purpose)`, `liveHref(path)`.
 * Editor-only buttons are hidden when `puckEditHref` is absent or returns null.
 */
export interface SiteBuilderHost extends HubCardHost {}
