// Shared (client + server) types for the desk: notes Justin leaves for Claude, and Claude's answers.

export const NOTE_KINDS = ["note", "question", "change", "bug", "idea", "update", "decision"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
/** The kinds Justin can pick when leaving a note. */
export const PERSON_KINDS: { kind: NoteKind; label: string }[] = [
  { kind: "note", label: "Note" },
  { kind: "question", label: "Question" },
  { kind: "change", label: "Change" },
  { kind: "bug", label: "Bug" },
  { kind: "idea", label: "Idea" },
];
export const NOTE_STATUSES = ["open", "seen", "doing", "done", "wontdo"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];
export const STATUS_LABEL: Record<NoteStatus, string> = {
  open: "Waiting for Claude",
  seen: "Claude has seen it",
  doing: "Claude is on it",
  done: "Done",
  wontdo: "Will not do",
};
export const LIMITS = { body: 4000, anchor: 300, anchorText: 300, path: 300 } as const;

export interface Note {
  id: string;
  parentId: string | null;
  path: string;
  anchor: string | null;
  anchorText: string | null;
  kind: NoteKind;
  body: string;
  options: string[] | null;
  answer: string | null;
  authorKind: "person" | "claude";
  authorName: string | null;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}
/** A top-level note and the replies under it, oldest first. */
export interface Thread extends Note {
  replies: Note[];
}

export type Fail = { ok: false; reason: "denied" | "setup" | "invalid" | "error"; message: string };
export type Result<T> = ({ ok: true } & T) | Fail;

export const isOpenStatus = (s: NoteStatus) => s === "open" || s === "seen" || s === "doing";

/** Link to a page and (through ?note=) the spot on it. `path` is app-relative; next/link adds the basePath. */
export function noteHref(n: Pick<Note, "id" | "path">): string {
  return `${n.path}${n.path.includes("?") ? "&" : "?"}note=${n.id}`;
}

/** Narrowing helper (this app compiles without strictNullChecks, where ok alone does not narrow). */
export function isFail(r: { ok: boolean }): r is Fail {
  return !r.ok;
}
