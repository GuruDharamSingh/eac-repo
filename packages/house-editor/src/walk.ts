import type { PuckDoc } from "@elkdonis/direct-edit/block";

// ============================================================================
// The two document walkers every canvas editor carried a copy of (sunjay,
// elktours, hidden-enneagram; moved here 2026-11-20). Pure, client and server safe.
// ============================================================================

/** Rows a data block's resolver fetched, by node id. */
export type ResolvedRows = Record<string, Record<string, unknown>>;

/** Which props each block's resolver fills (block id -> keys). */
export type ResolvedKeys = Readonly<Record<string, readonly string[]>>;

const holdsData = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v !== "" : typeof v === "object" && v !== null);
const hasSlot = (v: unknown) => Array.isArray(v) && v.some((x) => x && typeof x === "object" && "props" in x);

/**
 * Rows a data block's resolver fetched, by node id: drawn, never saved. Only the keys the
 * resolver fills (`keys`), because what is listed here wins over the node's own props when the
 * canvas draws, and a setting or a look kept here would stop answering to the panel.
 * A block that found nothing is left out, and draws its sample, labelled as one.
 */
export function resolvedRows(doc: PuckDoc, keys: ResolvedKeys = {}): ResolvedRows {
  const out: ResolvedRows = {};
  const go = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const n of list as Array<{ type?: string; props?: Record<string, unknown> }>) {
      if (!n?.props || typeof n.props.id !== "string") continue;
      const own = typeof n.type === "string" && Object.prototype.hasOwnProperty.call(keys, n.type) ? keys[n.type] : [];
      const rows = Object.fromEntries(own.filter((k) => k in n.props!).map((k) => [k, n.props![k]]));
      if (Object.values(rows).some(holdsData)) out[n.props.id] = rows;
      for (const v of Object.values(n.props)) if (hasSlot(v)) go(v);
    }
  };
  go(doc.content);
  return out;
}

/** The document with one node's props replaced, slots included. */
export function withProps(doc: PuckDoc, id: string, props: Record<string, unknown>): PuckDoc {
  const go = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.map((n: { type?: string; props?: Record<string, unknown> }) => {
          if (!n?.props) return n;
          if (n.props.id === id) return { ...n, props: { ...props, id } };
          let next = n.props;
          for (const [k, v] of Object.entries(n.props)) if (hasSlot(v)) next = { ...next, [k]: go(v) };
          return next === n.props ? n : { ...n, props: next };
        })
      : list;
  return { ...doc, content: go(doc.content) } as PuckDoc;
}
