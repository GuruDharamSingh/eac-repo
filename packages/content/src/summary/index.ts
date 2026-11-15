// The piece summary (design canvas "Studio pipeline frame", C; 2026-11-14): one published piece as its
// cover and facts, where it went and what is next. Props only and React only, so every site can mount
// it (a Board's side sheet, layout "sheet") without the Studio's heavy package; the Studio puts it in
// front of its forms (@elkdonis/studio/summary, PieceSummaryGate). CSS: `@elkdonis/content/summary.css`.
// Make into's targets and URL live here too: Create's Library, the summary and a site's Channel share them.
export { PieceSummary } from './PieceSummary';
export { makeIntoFor, makeIntoHref } from './make-into';
export type { MakeIntoTarget } from './make-into';
export type {
  PieceSummaryNext,
  PieceSummaryNextRow,
  PieceSummaryOut,
  PieceSummaryPlan,
  PieceSummaryPlanStep,
  PieceSummaryProps,
  PieceSummaryView,
} from './types';
