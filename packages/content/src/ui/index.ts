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
// The one picker: files in the library's language (docs/open/ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md §5).
export { MediaLibrary, acceptsFile } from "./MediaLibrary";
export type { MediaLibraryProps, MediaLibrarySource, MediaLibraryFile, MediaLibraryUpload, MediaLibraryMode, MediaLibraryView } from "./MediaLibrary";
export { PublishCardFace, PublishPopup } from "./PublishCard";
export type { PublishCardData, PublishCardFaceProps, PublishPopupProps } from "./PublishCard";
// v1 (CONTRACT §7, §10): the unified library's parts.
export type { LibraryGroupBy, LibraryFolderSource } from "./ContentLibrary";
export { ActionButton } from "./PieceLightbox";
export { useRemoteSearch } from "./library/use-remote-search";
export type { RemoteSource, RemoteState } from "./library/use-remote-search";
export { FileBrowser } from "./library/FileBrowser";
export type { FileBrowserProps } from "./library/FileBrowser";
export { ItemBadges, SALE_WORD } from "./library/badges";
export type { LibraryUpload } from "./library/upload";
