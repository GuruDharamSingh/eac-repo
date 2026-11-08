// @elkdonis/content/ui: the content detail and its parts. Client components;
// no next/*, no app actions (the host passes ContentDetailConnectors).

export { ContentDetail } from "./ContentDetail";
export type { ContentDetailProps, ContentDetailTab } from "./ContentDetail";
export { useContentConnectors } from "./connectors";
export type { ContentDetailConnectors, ContentActEntry, ContentActInputs, ContentActResult, ContentLinkComponent } from "./connectors";
export { IdentityMark, NextChip, OutletIcon, OUTLET_ICON, StateMark, StatusTag, Thumb, Timeline } from "./atoms";
export { CoveragePanel } from "./panels/coverage";
export { PlanPanel } from "./panels/plan";
export { KindStrip } from "./KindStrip";
export type { KindStripProps, KindStripVariant } from "./KindStrip";
export { PieceRow, PieceList } from "./PieceRow";
export type { PieceRowProps } from "./PieceRow";
export { PieceBrick, PieceLightbox } from "./PieceLightbox";
export type { PieceBrickProps, PieceLightboxProps, PieceLightboxAction } from "./PieceLightbox";
export { OutletMarks, KindLine, StatusChip } from "./piece-atoms";
export { ContentLibrary } from "./ContentLibrary";
export type { ContentLibraryProps, LibraryState, LibraryView, LibrarySort } from "./ContentLibrary";
export { PublishCardFace, PublishPopup } from "./PublishCard";
export type { PublishCardData, PublishCardFaceProps, PublishPopupProps } from "./PublishCard";
