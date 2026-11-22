import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { stripResolvedKeys } from "@elkdonis/blocks/record";
import type { ResolvedKeys } from "./walk";

// ============================================================================
// The page-save pieces every house editor shares. Server and client safe: no
// "use client", no database. A package cannot hold an app's "use server"
// function, so each app keeps a thin action that calls createSavePageAction.
// ============================================================================

/** What a save answers. Page-builder's `savePage` returns exactly this. */
export interface HouseSaveResult {
  ok: boolean;
  error?: string;
  /** The row changed since the editor loaded it; nothing was written. */
  stale?: boolean;
  /** The row's new version, held by the editor for its next save. */
  updatedAt?: string;
}

/** The app's gated save: `savePageAction(slug, doc, version?)`. */
export type HouseSave = (slug: string, data: unknown, version?: string) => Promise<HouseSaveResult>;

/** Said by the canvas when a save is refused as stale (it stays dirty, with the edits in it). */
export const STALE_CANVAS_MESSAGE =
  "This page was changed somewhere else since you opened it. Your edits are still here: copy anything you need, then reload to get the latest.";

export interface SavePageActionOptions {
  orgId: string;
  /** Who may publish. Falsy = refused with `denied`. The check lives in the action, never in the editor. */
  gate: () => unknown | Promise<unknown>;
  /** The refusal's words. */
  denied?: string;
  /** Why a page may not be saved at this slug, or null. Absent: no rule beyond the gate. */
  slugProblem?: (slug: string) => string | null | Promise<string | null>;
  /** Resolver-filled props removed before storing (the app's RESOLVED_KEYS). */
  resolvedKeys?: ResolvedKeys;
  /** Replaces the default cleaning, `cleanBoxDoc(stripResolvedKeys(data, resolvedKeys))`. */
  clean?: (data: unknown) => unknown;
  /** Runs after a successful save: the app's revalidatePath calls. */
  revalidate?: (slug: string) => void | Promise<void>;
  /** page-builder's `savePage` (from "@elkdonis/page-builder/server"), or anything with its shape. */
  store: (orgId: string, slug: string, data: unknown, expectedUpdatedAt?: string) => Promise<HouseSaveResult>;
}

/**
 * The page-save action, once. `expectedUpdatedAt` is the page's version as the editor loaded it (then as each save
 * returned it): when the row has changed since, nothing is written and the answer has `stale: true`. Absent:
 * unguarded, as before.
 */
export function createSavePageAction(o: SavePageActionOptions): HouseSave {
  return async (slug, data, expectedUpdatedAt) => {
    if (!(await o.gate())) return { ok: false, error: o.denied ?? "Only editors can publish pages." };
    const problem = o.slugProblem ? await o.slugProblem(slug) : null;
    if (problem) return { ok: false, error: problem };
    const cleaned = o.clean ? o.clean(data) : cleanBoxDoc(stripResolvedKeys(data, o.resolvedKeys ?? {}));
    const result = await o.store(o.orgId, slug, cleaned, expectedUpdatedAt);
    if (result.ok && o.revalidate) await o.revalidate(slug);
    return result;
  };
}

/**
 * The canvas's `onSave`, holding the version: the page's as loaded, then each successful save's. A refused save
 * answers `{ok:false, error}` so the canvas keeps its edits, stays dirty and says why.
 */
export function holdVersion(save: HouseSave, slug: string, version?: string) {
  let held = version;
  return async (doc: unknown): Promise<{ ok: boolean; error?: string }> => {
    const res = await save(slug, doc, held);
    if (res.ok) {
      if (res.updatedAt) held = res.updatedAt;
      return { ok: true };
    }
    return { ok: false, error: res.stale ? STALE_CANVAS_MESSAGE : res.error };
  };
}
