// The Board for a host outside /channel (2026-11-15; the hub's Channel card, docs/open/channel-convergence-2026-11-15
// C, B.3): the pure builders, the one-piece summary mapping, and the client table. ChannelGrid runs its moves
// through <ChannelDoor run={…}> (./runs): mount it with a site door (performSiteChannelAction for the site's org).
export { BOARD_COLUMNS, boardMark, markOf, type SiteLinks } from "./view";
export { boardGrid, weekGrid, pieceGrid, routineRows, type GridCol, type GridItem, type GridRow, type RowLinks } from "./grid-data";
export { buildPieceSummaryView, SUMMARY_STATE } from "./summary-view";
export { ChannelGrid, type ChannelGridProps, type PillStyle } from "./grid";
export { ChannelDoor } from "./runs";
