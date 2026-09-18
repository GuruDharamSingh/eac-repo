export {
  buildComposeCatalogue,
  findComposeOption,
} from "./catalogue";
export type { ComposeOption, ComposeKindId, ComposeContext } from "./catalogue";

export {
  QuestionBuilder,
  deriveFieldKey,
  validateQuestionFields,
  cleanQuestionFields,
} from "./QuestionBuilder";
export type { QuestionBuilderProps } from "./QuestionBuilder";

export { ComposeSheet, ComposePicker } from "./ComposeSheet";
export type { ComposeSheetProps } from "./ComposeSheet";

export { ContentComposer } from "./ContentComposer";
export { SessionsEditor, resourceTypeFor } from "./SessionsEditor";
export type { SessionDraft, SessionResourceDraft } from "./SessionsEditor";
export type { ContentComposerProps, ContentComposerSlots } from "./ContentComposer";

export { buildContentFields, emptyContentAnswers, groupHasValues } from "./content-fields";
export type {
  ContentKind,
  ContentTier,
  ContentFieldSpec,
  ContentFieldGroup,
  ContentFieldContext,
} from "./content-fields";
export {
  QuestionnaireBody,
  QuestionnaireComposeSurface,
  type QuestionnaireComposerKind,
  type QuestionnaireComposerProps,
  type SaveQuestionnaireResult,
} from "./QuestionnaireComposer";
export {
  ArtPieceComposer,
  type ArtPieceComposerProps,
  type ArtPieceInput,
  type ArtPieceStoreGate,
} from "./ArtPieceComposer";

