import { SHARED_BLOCKS, type Block } from "@elkdonis/blocks";
import { acOffering } from "@/blocks/ac-offering";
import { acPeople } from "@/blocks/ac-people";

// ============================================================================
// The blocks an org's landing page may hold: the shared library plus the two
// this app adds (the offering card and the people chips, both filled from the
// org in the page's metadata). Registered once here and read by both the
// editor config and the published config, so a block cannot be missing from
// one of them.
// ============================================================================

export const CATALOGUE: Block<never>[] = [
  ...SHARED_BLOCKS,
  acOffering as unknown as Block<never>,
  acPeople as unknown as Block<never>,
];

/**
 * Which props each data block's resolver fills. The save action removes these
 * before a page is stored, because the published page fetches them again on
 * every request (`resolveAllData`) and the editor's copy is not page content.
 */
export const RESOLVED_KEYS: Record<string, readonly string[]> = {
  "thread-feed": ["items"],
  "ac-offering": ["offering"],
  "ac-people": ["people"],
};

type Node = { type?: unknown; props?: Record<string, unknown> };

/** Copy of a Puck document with every resolver-filled prop removed. */
export function stripResolved<T>(data: T): T {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const node = value as Node;
    if (typeof node.type === "string" && node.props && typeof node.props === "object") {
      const drop = new Set(RESOLVED_KEYS[node.type] ?? []);
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node.props)) {
        if (!drop.has(k)) props[k] = walk(v);
      }
      return { ...node, props };
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
  };
  return walk(data) as T;
}
