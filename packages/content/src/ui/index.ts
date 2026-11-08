// @elkdonis/content/ui: the content detail and its parts. Client components;
// no next/*, no app actions (the host passes ContentDetailConnectors).

export { ContentDetail } from "./ContentDetail";
export type { ContentDetailProps, ContentDetailTab } from "./ContentDetail";
export { useContentConnectors } from "./connectors";
export type { ContentDetailConnectors, ContentActEntry, ContentActInputs, ContentActResult, ContentLinkComponent } from "./connectors";
export { IdentityMark, NextChip, OutletIcon, OUTLET_ICON, StateMark, StatusTag, Thumb, Timeline } from "./atoms";
export { CoveragePanel } from "./panels/coverage";
export { PlanPanel } from "./panels/plan";
