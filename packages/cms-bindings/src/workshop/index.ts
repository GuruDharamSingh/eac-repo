export type {
  WorkshopPageData,
  WorkshopSession,
  GalleryImage,
  WorkshopTemplates,
} from "./types";

export type {
  FieldInputType,
  FieldTable,
  FieldMeta,
  SelectOption,
  CompoundField,
  ThemeVarName,
  ThemeOverrides,
} from "./field-registry";

export { fieldRegistry, themeVarRegistry } from "./field-registry";

export { workshopFieldDefs, workshopCssVarDefs } from "./editor-config";

export {
  formatDate,
  formatTime,
  formatPrice,
  formatLevel,
  formatFormat,
  registrationCta,
  startsIn,
} from "./format";

export {
  setTextTrait,
  setDivTrait,
  setHrefTrait,
  setSrcTrait,
  buildScheduleHtml,
  buildGalleryHtml,
  renderWorkshopTemplate,
  applyWorkshopTraits,
} from "./render";
