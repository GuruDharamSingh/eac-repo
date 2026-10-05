/**
 * One place to make the Anthropic client and price its usage. Server only.
 *
 * An organisation-level key must name a workspace on every request
 * (ANTHROPIC_WORKSPACE_ID); a workspace-scoped key needs nothing more.
 */

import Anthropic from "@anthropic-ai/sdk";

export function anthropicClient(): Anthropic {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {});
}

/**
 * USD per million tokens, standard (non-batch) rates, from the Claude API
 * reference cached 2026-06-24. Batch requests cost half. Cache writes are
 * 1.25x input, cache reads 0.1x input.
 */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costUsd(model: string, u: Usage, batch = false): number | null {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  if (!key) return null;
  const p = PRICES[key];
  const m = batch ? 0.5 : 1;
  const input = u.input_tokens * p.input + (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 + (u.cache_read_input_tokens ?? 0) * p.input * 0.1;
  return ((input + u.output_tokens * p.output) / 1_000_000) * m;
}
