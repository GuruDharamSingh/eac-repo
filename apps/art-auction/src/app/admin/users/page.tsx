import type { Metadata } from "next";
import { adminListUsers } from "@elkdonis/commerce/queries";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Members · Admin" };

const STORE_STATUS_TONE: Record<string, BadgeProps["tone"]> = {
  active: "success",
  pending: "pending",
  paused: "neutral",
  rejected: "destructive",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminUsersPage() {
  const users = await adminListUsers({ limit: 50 });

  return (
    <section>
      <h2 className="mb-4 font-serif text-2xl tracking-tight">
        Members
        <span className="ml-2 text-base text-muted-foreground">({users.length})</span>
      </h2>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        People in the network — marketplace sellers and arts-collective
        members. Account-only signups are not shown.
      </p>
      {users.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No members yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Roles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">{u.displayName ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {u.artistStatus && (
                        <Badge tone={STORE_STATUS_TONE[u.artistStatus] ?? "neutral"}>
                          store · {u.artistStatus}
                        </Badge>
                      )}
                      {u.inCollective && <Badge tone="neutral">collective</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
