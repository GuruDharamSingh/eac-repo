/**
 * The Rosicrucian keyword system: `@elkdonis/astro/keywords`.
 *
 * Pure TypeScript, no native dependency, safe on the client. Reads a
 * ChartResult (or a single aspect) by the method in "Astrological Keyword
 * System of Analyzing Character and Destiny" (The Rosicrucian Fellowship).
 *
 *   readAspect(spec)      one aspect, the ten steps, learn + plain text
 *   readChart(chart)      key to the chart, every aspect, step-11 correlation
 *   ask(reading, q)       retrieve the sentences that answer a question
 *
 * See KEYWORDS.md in the package for how words are chosen.
 */

export * from "./domains";
export * from "./lexicon";
export * from "./nature";
export { newContext, pool, setsFor, bestPairs, bestFor, soloScore, type Context, type Pair, type PoolFilter } from "./select";
export {
  readAspect,
  readPlacement,
  aspectLabel,
  planetWeight,
  type AspectReading,
  type AspectSpec,
  type Placement,
  type PlacementReading,
  type ReadOptions,
  type Step,
  type Unit,
} from "./compose";
export { chartKey, readChart, type ChartKey, type ChartReading, type ChartReadOptions, type HouseGroup } from "./reading";
export { ask, questionVector, topicContext, type Answer } from "./ask";
export { parseDelineations, passagesFor, textVector, type CorpusHit, type Passage, type PassageKind } from "./corpus";
