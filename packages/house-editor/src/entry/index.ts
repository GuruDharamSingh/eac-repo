// @elkdonis/house-editor/entry: the one Edit button (client). A site mounts <EditEntry> once, in its layout, for people
// who may edit; its pages register how they edit in place; the Fields lens reads `live` from the same store.
export { EditEntry } from "./EditEntry";
export type { EditEntryProps } from "./EditEntry";
export { useEditEntry, getEditEntry, setLive, setEditing, registerEditPage } from "./store";
export type { EditEntryState } from "./store";
export { openSiteStyle, provideSiteStyle, openProvidedSiteStyle, hasSiteStyle } from "./site-style";
export type { SiteStyleHost } from "./site-style";
