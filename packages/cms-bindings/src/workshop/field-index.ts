/**
 * The workshop field index.
 *
 * The registry is keyed by trait, but almost every consumer needs the opposite
 * lookup — given a `table.column`, which field edits it? The manifest declares
 * `cmsFields` as columns, the live editor's save path resolves a trait to a
 * column, the wizard groups columns into steps, and the audit checks columns
 * against the registry. Each of those had (or was about to grow) its own
 * traversal of `fieldRegistry`, with its own tie-breaking.
 *
 * This is that traversal, once. Built at module load — the registry is static.
 *
 * Ties are common because several traits address one column: `spotsText` and
 * `spotsRemaining` both edit `threads.attendee_limit`, `startDate` and
 * `startsIn` both edit `threads.scheduled_at`, and a compound like `priceFull`
 * owns `threads.price` and `threads.currency` at once. Resolution order:
 *
 *   1. An editable entry beats a `readonly` one — a derived display value
 *      should never win over the field that actually sets it.
 *   2. A direct entry beats a compound member — a dedicated control for one
 *      column is more precise than a multi-column one that happens to include it.
 *   3. Otherwise, declaration order.
 */
import { fieldRegistry, type FieldMeta } from "./field-registry";

export interface FieldIndexEntry {
  trait: string;
  meta: FieldMeta;
  /** The column was reached through `meta.compound`, not `meta.col`. */
  viaCompound: boolean;
}

export type ColumnKey = string; // `${table}.${column}`

export function columnKey(table: string, col: string): ColumnKey {
  return `${table}.${col}`;
}

function beats(candidate: FieldIndexEntry, incumbent: FieldIndexEntry): boolean {
  const candidateEditable = candidate.meta.input !== "readonly";
  const incumbentEditable = incumbent.meta.input !== "readonly";
  if (candidateEditable !== incumbentEditable) return candidateEditable;

  if (candidate.viaCompound !== incumbent.viaCompound) return !candidate.viaCompound;

  return false; // declaration order stands
}

function build(): Map<ColumnKey, FieldIndexEntry> {
  const index = new Map<ColumnKey, FieldIndexEntry>();

  const offer = (key: ColumnKey, entry: FieldIndexEntry) => {
    const incumbent = index.get(key);
    if (!incumbent || beats(entry, incumbent)) index.set(key, entry);
  };

  for (const [trait, meta] of Object.entries(fieldRegistry)) {
    offer(columnKey(meta.table, meta.col), { trait, meta, viaCompound: false });
    for (const c of meta.compound ?? []) {
      offer(columnKey(c.table, c.col), { trait, meta, viaCompound: true });
    }
  }

  return index;
}

const byColumn = build();

/** Which field edits this column, if any. */
export function lookupColumn(table: string, col: string): FieldIndexEntry | undefined {
  return byColumn.get(columnKey(table, col));
}

export function lookupColumnKey(key: ColumnKey): FieldIndexEntry | undefined {
  return byColumn.get(key);
}

/** True when some field in the registry can edit this column. */
export function hasColumn(key: ColumnKey): boolean {
  return byColumn.has(key);
}

/** Every column reachable through the registry. */
export function indexedColumns(): Set<ColumnKey> {
  return new Set(byColumn.keys());
}

/**
 * Every column a trait writes — one for a simple field, several for a compound.
 * Used to claim all of a compound's columns at once so it is never asked twice.
 */
export function columnsForTrait(trait: string): ColumnKey[] {
  const meta = fieldRegistry[trait];
  if (!meta) return [];
  const keys = [columnKey(meta.table, meta.col)];
  for (const c of meta.compound ?? []) keys.push(columnKey(c.table, c.col));
  return [...new Set(keys)];
}

/** Registry entry for a trait. */
export function lookupTrait(trait: string): FieldMeta | undefined {
  return fieldRegistry[trait];
}

/** Diagnostics: columns addressed by more than one trait, and who won. */
export function ambiguousColumns(): Array<{
  column: ColumnKey;
  winner: string;
  alternatives: string[];
}> {
  const contenders = new Map<ColumnKey, string[]>();
  for (const [trait, meta] of Object.entries(fieldRegistry)) {
    const keys = [columnKey(meta.table, meta.col)];
    for (const c of meta.compound ?? []) keys.push(columnKey(c.table, c.col));
    for (const key of new Set(keys)) {
      contenders.set(key, [...(contenders.get(key) ?? []), trait]);
    }
  }

  const out: Array<{ column: ColumnKey; winner: string; alternatives: string[] }> = [];
  for (const [column, traits] of contenders) {
    if (traits.length < 2) continue;
    const winner = byColumn.get(column)?.trait ?? traits[0]!;
    out.push({ column, winner, alternatives: traits.filter((t) => t !== winner) });
  }
  return out.sort((a, b) => a.column.localeCompare(b.column));
}
