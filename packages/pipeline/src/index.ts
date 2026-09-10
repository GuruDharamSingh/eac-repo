// ============================================================================
// @elkdonis/pipeline — the org kanban board, shared.
//
// Every org's board is a Nextcloud Deck board (organizations.deck_board_id).
// All the Deck logic already lived in @elkdonis/services/org-deck.ts, scoped by
// orgId; what did NOT was the ~1,600 lines of UI and ~15 API routes, which were
// copied wholesale from amrit-canada into ifac. A fix to one would not have
// reached the other. This package is that surface, owned once.
//
// It vendors its own shadcn primitives rather than importing an app's: they are
// generated files, and reaching into `@/components/ui` would tie the package to
// one app's directory layout. It is deliberately NOT in @elkdonis/cms-ui, which
// documents a zero-dependency posture that Radix would break.
// ============================================================================

export { PipelineBoard } from "./components/PipelineBoard";
export { ProvisionBoard } from "./components/ProvisionBoard";
export { ArchivedCards } from "./components/ArchivedCards";
export { PipelineCard } from "./components/PipelineCard";
export { PipelineColumn } from "./components/PipelineColumn";
export { PipelineCardDialog } from "./components/PipelineCardDialog";
export { PipelineCardMenu } from "./components/PipelineCardMenu";

export * from "./deck-ui";
