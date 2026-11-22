// ============================================================================
// Fields lens: save routing (server-safe: no React, no DOM, no db import).
//
// createFieldsActions() builds the two functions an app's "use server" file exports:
//   load({kind, id})                      -> the record's stored values + a version
//   save({kind, id, values, version?})    -> checks, then routes the write
//
// Routing, per kind:
//   1. the registry names a capability AND the host gave `perform` AND the route has toInput: the save goes
//      through the atlas runner (performAction / performHubAction), so it inherits the gate, zod input,
//      audit row and the merge/allow-list the runner already has (the runner stamps updated_by);
//   2. else route.save(): the host's own function (it must merge, allow-list and stamp updated_by itself).
// One writer per value: the page marks no Puck-held words with data-field, and `declines` lets a host
// refuse a record by name; the canvas owns those.
// ============================================================================

import { checkValue, resolveFields, type FieldSpec, type FieldsRegistry } from "./registry";

/** The one earlier version a field keeps: the value a save replaced, who replaced it and when. "" = it was empty. */
export interface PreviousVersion {
  value: string;
  by: string | null;
  at: string;
}

export interface FieldsLoadResult {
  ok: boolean;
  error?: string;
  /** Per field: the one earlier version that can be put back (only for a record that keeps one). */
  previous?: Record<string, PreviousVersion>;
  /** The stored value per declared field ("" = nothing stored, the page shows its own default). */
  values?: Record<string, string>;
  /** Opaque; hand it back to save() as `version` to get the stale check. */
  version?: string;
  /** Present when nobody may change this record from here: the panel shows it and offers no Save. */
  readOnly?: string;
}

export interface FieldsSaveInput {
  kind: string;
  id: string;
  /** Only the fields that changed. "" clears a field. */
  values: Record<string, string>;
  /** From load(): when set and the stored version moved on, nothing is written and `stale` is true. */
  version?: string;
}

export interface FieldsSaveResult {
  ok: boolean;
  error?: string;
  stale?: boolean;
  values?: Record<string, string>;
  version?: string;
  previous?: Record<string, PreviousVersion>;
}

/** What performHubAction/performAction answer, loosely (the host adapts its own door to this). */
export type PerformResult = { ok: boolean; error?: string; data?: unknown };

export interface FieldsRoute {
  /**
   * The stored values and version of a record (a plain read). Null when nothing is stored yet.
   * `readOnly` is the reason nobody may change THIS record from here (a gathering that cannot be renamed yet): the
   * panel shows it, and a save is refused on the server too.
   */
  read(id: string): Promise<{ values: Record<string, string>; version: string; readOnly?: string; previous?: Record<string, PreviousVersion> } | null>;
  /**
   * Put one field back to its kept earlier version (the replaced value and the current one trade places, so it can be
   * undone again). The host's own function: it gates, validates and writes. Absent: the record keeps no earlier version.
   */
  restore?(id: string, field: string): Promise<PerformResult>;
  /**
   * Capability input for the values, or an error string (this id/field is not writable through the capability).
   * `subject` names what a subject-scoped entry acts on (a post's id for `thread-edit`).
   */
  toInput?(id: string, values: Record<string, string>): { input: unknown; subject?: string } | { error: string };
  /** Fallback writer when no runner exists. Must merge, allow-list and stamp updated_by itself. */
  save?(id: string, values: Record<string, string>): Promise<PerformResult>;
}

export interface FieldsActionsOptions {
  registry: FieldsRegistry;
  /** Who may use the lens at all. A string is the reason they may not. Re-checked on every call. */
  authorize(): Promise<true | string>;
  /** The host's door onto the atlas: performHubAction / performAction with the session's actor. */
  perform?(capability: string, input: unknown, subject?: string): Promise<PerformResult>;
  /**
   * Words of a block on a page, `block:<page>:<block id>:<prop>` (fields/blocks.ts createBlockFields). Kind "block" is
   * never in the registry: its fields come from the block's own declaration. Same `authorize()` gate; the save runs
   * through the app's gated page save, so its own gate applies as well.
   */
  blocks?: {
    load(id: string): Promise<{ ok: boolean; error?: string; values?: Record<string, string>; version?: string }>;
    save(id: string, values: Record<string, string>, version?: string): Promise<{ ok: boolean; error?: string; stale?: boolean; values?: Record<string, string>; version?: string }>;
  };
  routes: Record<string, FieldsRoute>;
  /** Records whose words live in a Puck document: refused here, the canvas owns them. A string is the reason. */
  declines?(kind: string, id: string): string | null;
}

export function createFieldsActions(o: FieldsActionsOptions) {
  async function gate(kind: string, id: string): Promise<{ error: string } | { fields: Record<string, FieldSpec>; route: FieldsRoute }> {
    const who = await o.authorize();
    if (who !== true) return { error: who || "Sign in as an editor to change this." };
    const fields = resolveFields(o.registry, kind, id);
    const route = o.routes[kind];
    if (!fields || !route) return { error: "That is not an editable field." };
    const declined = o.declines?.(kind, id);
    if (declined) return { error: declined };
    return { fields, route };
  }

  async function viaBlocks(): Promise<{ error: string } | null> {
    const who = await o.authorize();
    return who === true ? null : { error: who || "Sign in as an editor to change this." };
  }

  async function load(args: { kind: string; id: string }): Promise<FieldsLoadResult> {
    try {
      if (args.kind === "block" && o.blocks) {
        const no = await viaBlocks();
        if (no) return { ok: false, error: no.error };
        return await o.blocks.load(args.id);
      }
      const g = await gate(args.kind, args.id);
      if ("error" in g) return { ok: false, error: g.error };
      const rec = await g.route.read(args.id);
      const values: Record<string, string> = {};
      for (const f of Object.keys(g.fields)) values[f] = rec?.values[f] ?? "";
      return {
        ok: true, values, version: rec?.version ?? "",
        ...(rec?.readOnly ? { readOnly: rec.readOnly } : {}),
        ...(rec?.previous ? { previous: rec.previous } : {}),
      };
    } catch (err) {
      console.error("[fields] load:", err);
      return { ok: false, error: "Could not load this." };
    }
  }

  async function save(input: FieldsSaveInput): Promise<FieldsSaveResult> {
    try {
      if (input.kind === "block" && o.blocks) {
        const no = await viaBlocks();
        if (no) return { ok: false, error: no.error };
        return await o.blocks.save(input.id, input.values ?? {}, input.version);
      }
      const g = await gate(input.kind, input.id);
      if ("error" in g) return { ok: false, error: g.error };
      // Allow-list: only declared fields, each checked by its own spec.
      const clean: Record<string, string> = {};
      for (const [name, raw] of Object.entries(input.values ?? {})) {
        const spec = g.fields[name];
        if (!spec) return { ok: false, error: `${name} is not an editable field.` };
        const c = checkValue(spec, raw);
        if (!c.ok) return { ok: false, error: c.error };
        clean[name] = c.value;
      }
      if (Object.keys(clean).length === 0) return { ok: true };
      // A record nobody may change from here, and the stale check where the store has a version.
      const now = await g.route.read(input.id);
      if (now?.readOnly) return { ok: false, error: now.readOnly };
      if (input.version !== undefined && (now?.version ?? "") !== input.version) return { ok: false, stale: true, error: "This was changed elsewhere. Reload to see the newest version." };
      const capability = o.registry[input.kind]?.capability;
      let result: PerformResult;
      if (capability && o.perform && g.route.toInput) {
        const routed = g.route.toInput(input.id, clean);
        if ("error" in routed) return { ok: false, error: routed.error };
        result = await o.perform(capability, routed.input, routed.subject);
      } else if (g.route.save) {
        result = await g.route.save(input.id, clean);
      } else {
        return { ok: false, error: "Nothing is set up to save this yet." };
      }
      if (!result.ok) return { ok: false, error: result.error || "That could not be saved." };
      const after = await g.route.read(input.id).catch(() => null);
      return { ok: true, values: after?.values, version: after?.version, previous: after?.previous };
    } catch (err) {
      console.error("[fields] save:", err);
      return { ok: false, error: "Could not save. Try again." };
    }
  }

  /** Put a field back to its kept earlier version. Same gate as a save; the host's route does the write. */
  async function restore(input: { kind: string; id: string; field: string }): Promise<FieldsSaveResult> {
    try {
      const g = await gate(input.kind, input.id);
      if ("error" in g) return { ok: false, error: g.error };
      if (!g.fields[input.field]) return { ok: false, error: `${input.field} is not an editable field.` };
      if (!g.route.restore) return { ok: false, error: "This record keeps no earlier version." };
      const now = await g.route.read(input.id);
      if (now?.readOnly) return { ok: false, error: now.readOnly };
      const result = await g.route.restore(input.id, input.field);
      if (!result.ok) return { ok: false, error: result.error || "That could not be put back." };
      const after = await g.route.read(input.id).catch(() => null);
      return { ok: true, values: after?.values, version: after?.version, previous: after?.previous };
    } catch (err) {
      console.error("[fields] restore:", err);
      return { ok: false, error: "Could not put it back. Try again." };
    }
  }

  return { load, save, restore };
}
