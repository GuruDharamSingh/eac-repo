import type { StoreMember } from "@elkdonis/commerce/types";
import { addStoreMemberAction, removeStoreMemberAction } from "../actions";

/**
 * Who may act for an org's store. Deliberately NOT the org's membership
 * (migration 094): being a member of the org should not let you price its
 * work. Owners manage the roll; everyone on it sees it.
 */
export function TeamPanel({
  members,
  canEdit,
  selfUserId,
  error,
}: {
  members: StoreMember[];
  canEdit: boolean;
  selfUserId: string;
  error?: string | null;
}) {
  const inputCls =
    "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:ring-[2px] focus:ring-ring/50";
  return (
    <div className="rounded-lg border border-border">
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-4 p-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {m.displayName?.trim() || m.email || "Member"}
                {m.userId === selfUserId && (
                  <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                )}
              </p>
              {m.email && m.displayName && (
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{m.role}</span>
              {canEdit && (
                <form action={removeStoreMemberAction.bind(null, m.userId)}>
                  <button
                    type="submit"
                    className="text-xs text-destructive underline-offset-4 hover:underline"
                  >
                    Remove
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form action={addStoreMemberAction} className="flex flex-wrap items-center gap-2 border-t border-border p-4">
          <input
            name="email"
            type="email"
            required
            placeholder="member@example.com"
            className={`${inputCls} flex-1`}
          />
          <select name="role" defaultValue="staff" className={inputCls}>
            <option value="staff">staff — list &amp; edit work</option>
            <option value="manager">manager — also sales</option>
            <option value="owner">owner — also the team</option>
          </select>
          <button
            type="submit"
            className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Add
          </button>
          {error && <p className="w-full text-xs text-destructive">{error}</p>}
        </form>
      )}
    </div>
  );
}
