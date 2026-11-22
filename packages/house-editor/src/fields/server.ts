// @elkdonis/house-editor/fields/server: the server-safe half of the Fields lens (registry + save routing).
export { defineFields, parseFieldRef, formatFieldRef, resolveFields, recordLabel, checkValue, linkOk, isInline } from "./registry";
export type { FieldSpec, FieldKind, KindSpec, RecordSpec, FieldsRegistry, FieldRef } from "./registry";
export { createFieldsActions } from "./save";
export type {
  FieldsActionsOptions, FieldsRoute, FieldsLoadResult, FieldsSaveInput, FieldsSaveResult, PerformResult, PreviousVersion,
} from "./save";
export { createBlockFields, fieldMapOf, blockSpecs, splitBlockId, recordMarks } from "./blocks";
// One site's two doors (block words, a post's title) bound once: elktours, hidden-enneagram, innergathering (2026-11-20).
export { createSiteFields, READ_ONLY_THREAD, READ_ONLY_POSTS } from "./site";
export type { SiteFieldsOptions } from "./site";
export { siteFieldsRegistry } from "./site-registry";
export type { BlockFieldsOptions, BlockLoad, BlockSave, RecordMarkSpec, BlockFieldMap, BlockFieldEntry, BlockPartField, BlockMapSource } from "./blocks";
export { scanBlocks, pageSlugOf } from "./scan";
export type { FoundField } from "./scan";
