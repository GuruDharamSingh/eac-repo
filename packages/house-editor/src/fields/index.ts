// @elkdonis/house-editor/fields: the Fields lens (client: React; cms-ui's rich editor loads lazily).
// A server file imports "@elkdonis/house-editor/fields/server" instead (registry + save routing, no React).
export { FieldsLens } from "./FieldsLens";
export type { FieldsLensProps, FieldsPictureChooser } from "./FieldsLens";
export { defineFields, parseFieldRef, formatFieldRef, resolveFields, recordLabel, checkValue, linkOk, isInline } from "./registry";
export type { FieldSpec, FieldKind, KindSpec, RecordSpec, FieldsRegistry, FieldRef } from "./registry";
export type { FieldsLoadResult, FieldsSaveInput, FieldsSaveResult, PreviousVersion } from "./save";
export { siteFieldsRegistry } from "./site-registry";
export { scanBlocks, pageSlugOf } from "./scan";
export type { FoundField } from "./scan";
export { blockSpecs, fieldMapOf, splitBlockId } from "./blockmap";
export type { BlockFieldMap, BlockFieldEntry, BlockPartField, BlockMapSource } from "./blockmap";
