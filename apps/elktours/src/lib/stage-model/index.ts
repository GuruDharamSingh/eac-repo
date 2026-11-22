// The neutral stage model (STAGE lane, 2026-11-21). Not wired into any component yet: see docs/open/ELKTOURS_BLOCK_FORWARD_2026-11-21/STAGE.md.
export * from "./types";
export { STAGE_VOCABULARY, vocabularyFor, countOf, type StageVocabulary } from "./vocabulary";
export { tourToStageModel, stageModelToIndexModel } from "./tour-adapter";
