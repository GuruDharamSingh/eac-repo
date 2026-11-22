// Shapes shared by the versions store (server) and its screens (client). No imports from the server side.

export interface VersionRow {
  id: string;
  subject: string;
  parentId: string | null;
  branch: string;
  note: string;
  /** The one-block Puck data, looks included. */
  doc: unknown;
  theme: string | null;
  author: string | null;
  kept: boolean;
  createdAt: string;
}

export interface DraftRow {
  id: string;
  subject: string;
  /** The version the working copy started from (null = from the block's defaults). */
  baseId: string | null;
  doc: unknown;
  theme: string | null;
  updatedAt: string;
}

export interface History {
  versions: VersionRow[];
  draft: DraftRow | null;
}

export type Fail = { ok: false; reason: "setup" | "denied" | "invalid" | "needs-name" | "error"; message: string; suggested?: string };
export type Ok<T> = { ok: true } & T;
export type Result<T> = Ok<T> | Fail;

/** "Try 2": the default name for a new branch, given the names already used. */
export function nextBranchName(used: string[]): string {
  let n = Math.max(1, used.length);
  while (used.includes(`Try ${n}`)) n += 1;
  return `Try ${n}`;
}

/** True when saving from `baseId` would start a new branch (that version already has a child, or this is a second root). */
export function startsBranch(versions: Pick<VersionRow, "id" | "parentId">[], baseId: string | null): boolean {
  if (baseId === null) return versions.length > 0;
  return versions.some((v) => v.parentId === baseId);
}

/** Narrowing helper (this app compiles without strictNullChecks, where `ok` alone does not narrow). */
export function isFail(r: { ok: boolean }): r is Fail {
  return r.ok === false;
}
