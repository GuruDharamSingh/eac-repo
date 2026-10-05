// The essay canvas's document model and its renderer. Pure, DOM-free, so the
// server action renders the page HTML and the Studio renders its preview
// from one function (docs/open/BLOCK_CANVAS_BRIEF_2026-09-27.md §3.2). Lives
// in utils rather than its own package because @elkdonis/services imports
// it and every app already transpiles utils.
export { renderEssayHtml, essayWordCount, essayIsEmpty } from './essay-render';
export { ESSAY_NODES } from './essay-types';
export type { EssayDoc, EssayNode, EssayMark, EssayWidth, RenderOptions, ThreadCardAttrs } from './essay-types';
