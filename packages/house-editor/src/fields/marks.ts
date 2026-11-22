// Fields lens: where a shown value comes from (contract C4). Pure, no imports: a host's published-page config may import it.
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

// ---------------------------------------------------------------------------
// where a shown value comes from
// ---------------------------------------------------------------------------

export interface RecordMarkSpec {
  /** The setting that names the record (a `binds` prop holding `<kind>:<id>`), as in feature-card's `record`. */
  ref: string;
  /** The record kinds a reference may name, as C4's `record:<kind>:...`. */
  kinds: readonly string[];
  /** The prop under which the host's resolver put the record it read (feature-card: `bound`). */
  resolved: string;
  /** Setting shown -> the record's field that fills it when the setting is left empty (feature-card: title -> title, body -> excerpt). */
  fills: Readonly<Record<string, string>>;
}

/**
 * The `from` hook for `buildPuckConfig({ marks: { from } })`. For a block listed in `specs`, a setting left empty
 * whose record has a value of that name is drawn FROM the record: the mark says `{ <setting>: "record:<kind>:<id>:<field>" }`
 * so the lens offers the record's own field there instead of a block setting. A typed setting wins over the record
 * (feature-card.tsx: "typed first; the record fills only what was left blank"), so it is not listed.
 */
export function recordMarks(specs: Readonly<Record<string, RecordMarkSpec>>) {
  return ({ type, props }: { type: string; props: Record<string, unknown> }): Record<string, string> | null => {
    const spec = own(specs, type) ? specs[type] : undefined;
    if (!spec) return null;
    const raw = props[spec.ref];
    const m = typeof raw === "string" ? /^([a-z]+):([A-Za-z0-9_-]{1,64})$/.exec(raw.trim()) : null;
    if (!m || !spec.kinds.includes(m[1]!)) return null;
    const record = props[spec.resolved];
    if (!record || typeof record !== "object") return null;
    const out: Record<string, string> = {};
    for (const [prop, field] of Object.entries(spec.fills)) {
      const typed = props[prop];
      const there = (record as Record<string, unknown>)[field];
      if ((typeof typed !== "string" || typed.trim() === "") && typeof there === "string" && there.trim() !== "") out[prop] = `record:${m[1]}:${m[2]}:${field}`;
    }
    return Object.keys(out).length ? out : null;
  };
}
