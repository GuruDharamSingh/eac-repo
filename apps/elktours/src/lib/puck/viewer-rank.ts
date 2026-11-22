// Who may see a thing, as one small table (2026-11-21). No imports: the phone blocks, their server resolvers, the
// editor actions and the checks all read it. The decision is made on the server from the session; a block draws only
// what the resolver returned, so a visitor's HTML never holds a label or link they may not see.

/** Who a button or menu item is for. `signed-out` is for visitors only (a "Log in" button). */
export const WHO_OPTIONS = [
  { value: "everyone", label: "Everyone" },
  { value: "signed-out", label: "Only people who are signed out" },
  { value: "signed-in", label: "Anyone signed in" },
  { value: "member", label: "Members and above" },
  { value: "guide", label: "Guides and above" },
  { value: "owner", label: "Owners only" },
] as const;
export type Who = (typeof WHO_OPTIONS)[number]["value"];

/** What the server knows of the person looking: null = signed out; role = their role in THIS organisation, or null. */
export interface ViewerLike { role: string | null; name?: string | null }

const ROLE_RANK: Record<string, number> = { owner: 4, guide: 3, member: 2 };

/** 0 signed out, 1 signed in without a role here (or a follower), 2 member, 3 guide, 4 owner. */
export function rankOf(v: ViewerLike | null): number {
  if (!v) return 0;
  return ROLE_RANK[v.role ?? ""] ?? 1;
}

const NEEDS: Record<string, number> = { "signed-in": 1, member: 2, guide: 3, owner: 4 };

/** Whether `who` includes this viewer. An unknown value shows to nobody (a typo must not widen who sees a button). */
export function allows(who: unknown, v: ViewerLike | null): boolean {
  if (who === undefined || who === "" || who === "everyone") return true;
  if (who === "signed-out") return v === null;
  const need = typeof who === "string" ? NEEDS[who] : undefined;
  return need !== undefined && rankOf(v) >= need;
}
