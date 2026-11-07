// ============================================================================
// Resolver keys never become page content. A data block's resolveData fills
// props the author never typed (the fetched record, its placement...); the
// save action removes them before the page is stored, so the next render reads
// the record again. Each app keeps its own table, block id -> keys:
//
//   export const RESOLVED_KEYS = { "ktp-piece": ["item", "placement", "sampled", "hrefBase"] };
//   await savePage(slug, stripResolvedKeys(data, RESOLVED_KEYS));
//
// A resolver key must never equal a prop name, or the author's value is
// dropped on save. Pure, client-safe.
// ============================================================================

type Node = { type?: unknown; props?: Record<string, unknown> };

/**
 * Copy of a Puck document with every resolver-filled prop removed. Walks the
 * whole value, so blocks inside slots (props holding arrays of nodes), zones
 * and `content` are all cleaned.
 */
export function stripResolvedKeys<T>(data: T, keys: Readonly<Record<string, readonly string[]>>): T {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const node = value as Node;
    if (typeof node.type === "string" && node.props && typeof node.props === "object") {
      const drop = new Set(Object.prototype.hasOwnProperty.call(keys, node.type) ? keys[node.type] : []);
      // Object.fromEntries defines own properties, so a stored key named `__proto__` stays data instead of
      // becoming the new object's prototype, as `props[k] = …` would make it (2026-11-06).
      const props: Record<string, unknown> = Object.fromEntries(
        Object.entries(node.props).filter(([k]) => !drop.has(k)).map(([k, v]) => [k, walk(v)]),
      );
      return { ...node, props };
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
  };
  return walk(data) as T;
}
