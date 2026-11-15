// The piece summary in the Studio (canvas C, 2026-11-14). The component and Make into live in
// @elkdonis/content/summary (React only, so sites mount it without this package); re-exported here.
// `PieceSummaryGate` + `PieceSummaryHostContext` put it in front of the Studio's forms for published
// pieces. CSS: `@elkdonis/content/summary.css`.
export { PieceSummary, makeIntoFor, makeIntoHref } from '@elkdonis/content/summary';
export type { MakeIntoTarget, PieceSummaryNext, PieceSummaryOut, PieceSummaryProps, PieceSummaryView } from '@elkdonis/content/summary';
export { PieceSummaryGate, PieceSummaryHostContext, type PieceSummaryHost } from './gate';
