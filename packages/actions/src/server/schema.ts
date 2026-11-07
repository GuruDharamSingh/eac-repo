/**
 * An entry's input as JSON Schema (2026-11-06), for callers outside
 * TypeScript: the catalogue route, a dock on another site, a script.
 *
 * Built from the runner's zod/v4 schema (`actionInputSchema`). `io: 'input'`
 * describes what a caller sends, before `.trim()` and other transforms. A
 * refine's rule (e.g. `org-email`'s address check) has no JSON Schema form
 * and is not in the output; the server still applies it.
 */
import { z } from 'zod/v4';
import { actionInputSchema } from './run';

const cache = new Map<string, Record<string, unknown> | null>();

/** JSON Schema (draft 2020-12) of an entry's input; null when it takes none, has no runner, or cannot be described. */
export function actionJsonSchema(id: string): Record<string, unknown> | null {
  if (cache.has(id)) return cache.get(id)!;
  const schema = actionInputSchema(id);
  let out: Record<string, unknown> | null = null;
  if (schema) {
    try {
      out = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    } catch (err) {
      console.error('[actions] json schema:', id, err);
    }
  }
  cache.set(id, out);
  return out;
}
