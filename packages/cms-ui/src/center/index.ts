// ============================================================================
// @elkdonis/cms-ui/center — the follower's home on an org's site.
//
//   import "@elkdonis/cms-ui/surface.css";   (tokens and faces)
//   import "@elkdonis/cms-ui/center.css";    (the two-column layout)
//   import { CenterPage } from "@elkdonis/cms-ui/center";
//
// A host reads `loadCenter` from @elkdonis/services, decides its own hrefs
// (CenterLinks), and renders <CenterPage>. With a SurfaceProvider mounted
// above it, faces open in place; without one they navigate.
// Brief: CENTER_PAGE_BRIEF_2026-09-09.md.
// ============================================================================

export { CenterPage } from "./CenterPage";
export { ProfileFlipCard } from "./ProfileFlipCard";
export type { ProfileCardAction, ProfileCardBadge } from "./ProfileFlipCard";
export { JourneyRow } from "./JourneyTabs";
export { OrgManage } from "./OrgManage";
export type { JourneyTabId, JourneyOrgFacts } from "./JourneyTabs";
export type { CenterPageProps, CenterHeading } from "./CenterPage";
// The common CenterLinks of a single-org site; hosts pass what only they know.
export { buildOrgSiteCenterLinks, orgDoorUrl } from "./host-links";
export type { OrgSiteCenterLinksInput, OrgSiteHome } from "./host-links";
export { CenterThreadRow } from "./CenterThreadRow";
export { FollowButton } from "./FollowButton";
export { ArrangeButton } from "./ArrangeButton";
export { CenterDesk } from "./CenterDesk";
export type { CenterDeskItem } from "./CenterDesk";
export { FeedSwitch } from "./FeedSwitch";
export { OrgStrip } from "./OrgStrip";
export type { OrgStripItem } from "./OrgStrip";
// The network hub's mirror of /center (Brief A slice 4).
export { OrgSwitcher } from "./OrgSwitcher";
export type { OrgSwitcherItem, OrgSwitcherAction } from "./OrgSwitcher";
export { PersonPanel } from "./PersonPanel";
export { ListingRequests } from "./ListingRequests";
export type { ListingRequestItem } from "./ListingRequests";
export type {
  CenterData,
  CenterThread,
  CenterPerson,
  CenterOrg,
  CenterOrgLink,
  CenterPromo,
  CenterJourney,
  CenterLinks,
  CenterRole,
} from "./types";
export { DEFAULT_CENTER_LAYOUT } from "./layout";
export type { CenterLayout, CenterSectionId } from "./layout";
