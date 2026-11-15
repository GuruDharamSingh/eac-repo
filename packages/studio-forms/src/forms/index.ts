// ============================================================================
// @elkdonis/studio-forms: the publication forms, essentials entry (pass 1).
// Plan: docs/open/publishing-forms-handoff/PLAN.md.
//
// No tiptap, no three, no Remotion here: quick compose and the site-inline
// variant import only this. The heavy editors (the essay Canvas, cms-ui's
// RichTextEditor) and the Studio extension wrapper are in ./forms/focus.
// CSS: @elkdonis/studio-forms.css, and a theme such as /forms/broadsheet.css.
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
  specKindOf,
  useFormState,
  visibleSections,
} from './state';
export type { FormController, FormEvent, FormReducerDeps, Readiness, UseFormStateOptions } from './state';

export { PERSONAL_ORG, channelStoreOf } from './channel-link';
export { PLATFORM_PRESETS, PRESET_KEYS, orderPresets, presetFromAnswers, summarise } from './presets';

export { meetingActions, meetingAnswers, resolveMeetingAnswers, whereModeOf, DERIVED_FORM_KEYS } from './adapters/meeting';
export type { MeetingAdapterOptions, WhereMode } from './adapters/meeting';
export { studioPostActions, postAnswers, postPatch } from './adapters/post-studio';
export type { StudioPostOptions } from './adapters/post-studio';
export { sitePostActions, sitePostAnswers, sitePostInput } from './adapters/site-post';
export { workshopActions, workshopAnswersForSave } from './adapters/workshop';
export type { WorkshopActions, WorkshopContextView, WorkshopRecordView } from './adapters/workshop';
export { seriesCreateActions, seriesCreateInput, seriesModeOf, seriesDatesOf } from './adapters/series-create';
export type { SeriesCreateActions, SeriesCreateInputView, SeriesCreateRecordView, SeriesMode } from './adapters/series-create';
export type { SitePostActions, SitePostContextView, SitePostInputView, SitePostRecordView, SitePostRole, SitePostVisibility, SitePostAudience } from './adapters/site-post';
export { seriesActions, seriesInputFromAnswers, seriesAnswers } from './adapters/series';
export type { SeriesActions, SeriesFormInputView, SeriesRecordView, SeriesSessionView, SeriesPageView } from './adapters/series';
export { artworkActions, artworkInputFromAnswers, artworkAnswers, ARTWORK_CURRENCIES } from './adapters/artwork';
export type { ArtworkActions, ArtworkContextView, ArtworkInputView, ArtworkRecordView } from './adapters/artwork';
export { serviceActions, serviceAnswersForSave, SERVICE_CURRENCIES } from './adapters/service';
export type { ServiceActions, ServiceContextView, ServiceRecordView } from './adapters/service';

export { postKind, sitePostKind, POST_LAYOUT } from './kinds/post';
export { meetingKind, eventKind, MEETING_LAYOUT } from './kinds/meeting';
export { seriesKind, emptySeriesAnswers } from './kinds/series';
export { workshopKind, emptyWorkshopAnswers } from './kinds/workshop';
export { artworkKind, ARTWORK_LAYOUT } from './kinds/artwork';
export { serviceKind, SERVICE_LAYOUT } from './kinds/service';
export { rulesFor, POST_RULES, MEETING_RULES, ARTWORK_RULES, SERVICE_RULES } from './rules';

export * from './theme';
export * from './fields';
export * from './preview';
export * from './shell';
