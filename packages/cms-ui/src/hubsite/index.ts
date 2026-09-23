// ============================================================================
// @elkdonis/cms-ui/hubsite — the hub laid out as a page, not a grid of cards.
//
//   import "@elkdonis/cms-ui/hubsite.css";
//
// Top to bottom (user's spec, 2026-09-18): the next meeting as a banner;
// your picture beside a plain calendar; the group's latest; a one-line
// compose that unfolds; files beside the whiteboard, with three small doors
// under them; the gallery as a hero carousel. An ALTERNATIVE to the card hub,
// chosen per person with HubViewToggle — the card hub is untouched.
// Every piece opens the host's existing surfaces, so it needs the same
// SurfaceProvider the card hub uses.
// ============================================================================

export { MeetingBanner, type MeetingBannerData, type MeetingAttendanceOption } from "./MeetingBanner";
export { CrossPostCycler, type CrossPostItem } from "./CrossPostCycler";
export { HubCalendar } from "./HubCalendar";
export { HubPortrait } from "./HubPortrait";
export { ActivityFeed, type ActivityItem } from "./ActivityFeed";
export { InlineCompose } from "./InlineCompose";
export { FileBrowser, type FileBrowserSource } from "./FileBrowser";
export { WhiteboardPanel, HubDoors } from "./HubTools";
export { GalleryHero, type GalleryHeroImage } from "./GalleryHero";
export { HubViewToggle } from "./HubViewToggle";
export { HUB_VIEW_COOKIE, type HubView } from "./view-cookie";
export { FileIcon, familyOf, familyName, type FileFamily } from "./file-types";
