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

export { CenterPage, ProfileCardBody } from "./CenterPage";
export type { CenterPageProps } from "./CenterPage";
export { CenterThreadRow } from "./CenterThreadRow";
export { FollowButton } from "./FollowButton";
export { ArrangeButton } from "./ArrangeButton";
export { OrgStrip } from "./OrgStrip";
export type { OrgStripItem } from "./OrgStrip";
export type {
  CenterData,
  CenterThread,
  CenterPerson,
  CenterOrg,
  CenterOrgLink,
  CenterPromo,
  CenterLinks,
  CenterRole,
} from "./types";
export { DEFAULT_CENTER_LAYOUT } from "./layout";
export type { CenterLayout, CenterSectionId } from "./layout";
