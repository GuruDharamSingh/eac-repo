// ============================================================================
// @elkdonis/studio/forms: the publication forms, essentials entry (pass 1).
// Plan: docs/open/publishing-forms-handoff/PLAN.md.
//
// No tiptap, no three, no Remotion here: quick compose and the site-inline
// variant import only this. The heavy editors (the essay Canvas, cms-ui's
// RichTextEditor) and the Studio extension wrapper are in ./forms/focus.
// CSS: @elkdonis/studio/forms.css, and a theme such as /forms/broadsheet.css.
// The harness (forms/harness) is never exported: it imports the Canvas.
// ============================================================================

export type * from './contract';
export { FRAME_MESSAGE_SOURCE } from './contract';

export {
  alertTitle,
  applyPreset,
  blocking,
  computeIssues,
  contentKindOf,
  formReducer,
  initialFormState,
  isFilled,
  readAnswer,
  readiness,
  sectionFieldNames,
  sectionStatus,
  useFormState,
  visibleSections,
} from './state';
export type { FormController, FormEvent, FormReducerDeps, Readiness, UseFormStateOptions } from './state';

export { PLATFORM_PRESETS, PRESET_KEYS, orderPresets, presetFromAnswers, summarise } from './presets';

export { gatheringActions, gatheringAnswers, resolveGatheringAnswers, whereModeOf, DERIVED_FORM_KEYS } from './adapters/gathering';
export type { GatheringAdapterOptions, WhereMode } from './adapters/gathering';
export { studioPostActions, postAnswers, postPatch } from './adapters/post-studio';
export type { StudioPostOptions } from './adapters/post-studio';

export { postKind, POST_LAYOUT } from './kinds/post';
export { gatheringKind, GATHERING_LAYOUT } from './kinds/gathering';
export { rulesFor, POST_RULES, GATHERING_RULES } from './rules';

export * from './theme';
export * from './fields';
export * from './preview';
export * from './shell';
