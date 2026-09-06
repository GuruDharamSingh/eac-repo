export type {
  WorkshopPageData,
  WorkshopSession,
  GalleryImage,
} from "./types";

export type {
  FieldInputType,
  LiveEditorInputType,
  FieldTable,
  FieldMeta,
  SelectOption,
  CompoundField,
  ThemeVarName,
  ThemeOverrides,
} from "./field-registry";

export { fieldRegistry, themeVarRegistry, isLiveEditorInput } from "./field-registry";

export type {
  WizardField,
  WizardStep,
  WizardStepSource,
  BuildWizardOptions,
  PlatformStepDef,
} from "./wizard-config";

export {
  buildWorkshopWizardSteps,
  requiredTraits,
  DEFAULT_PLATFORM_STEPS,
} from "./wizard-config";

export type {
  WizardUiStep,
  WizardUiField,
  WizardUiInput,
  WizardUiSlot,
} from "./wizard-ui";
export { toWizardUiSteps, wizardAnswersToColumns } from "./wizard-ui";

export type { WorkshopFacilitator, WorkshopRenderContext } from "./context";
export { toWorkshopContext } from "./context";

export type { FieldIndexEntry, ColumnKey } from "./field-index";
export {
  columnKey,
  lookupColumn,
  lookupColumnKey,
  lookupTrait,
  hasColumn,
  indexedColumns,
  columnsForTrait,
  ambiguousColumns,
} from "./field-index";

export type { MappedOffering } from "./offering-mapping";
export {
  COLUMN_TO_INPUT_KEY,
  answersToOfferingInput,
  unmappedColumns,
  coerceValue,
} from "./offering-mapping";

export { workshopFieldDefs, workshopCssVarDefs } from "./editor-config";

export type { SectionAudit, TemplateAudit } from "./audit";
export {
  auditTemplateBindings,
  formatTemplateAudit,
  extractTraits,
} from "./audit";

// Formatting helpers for consumers that render workshop data directly (not
// through the template). The template's own formatting goes through the
// binding-engine formatter registry (`@elkdonis/cms-bindings/engine`).
export {
  formatDate,
  formatTime,
  formatPrice,
  formatLevel,
  formatFormat,
  registrationCta,
  startsIn,
} from "./format";
