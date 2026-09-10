/**
 * The declarative template-binding engine.
 *
 * Template-agnostic: workshop, dossier, enneagram, portfolio and future thread
 * kinds all bind through this, driven by their manifest. No per-template
 * renderer.
 */

export { applyBindings, applyManifestBindings, removeSections } from "./apply";
export { resolvePath, isEmptyValue, toDisplayString } from "./path";
export { builtinFormatters } from "./formatters";
export {
  validateBindings,
  extractTraitNames,
  formatIssues,
} from "./validate";

export type {
  Binding,
  BindingKind,
  BindingMap,
  BindingCommon,
  TextBinding,
  HtmlBinding,
  AttrBinding,
  StyleBinding,
  ClassBinding,
  ShowBinding,
  ListBinding,
  Formatter,
  FormatterMap,
  ApplyOptions,
} from "./types";

export type {
  ValidationIssue,
  IssueSeverity,
  SectionToValidate,
  ValidateOptions,
} from "./validate";
