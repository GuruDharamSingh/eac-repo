"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrgRole = "owner" | "guide" | "member" | "viewer";

export type MemberRow = {
  userId: string;
  email: string;
  displayName: string | null;
  role: OrgRole;
};

const ROLE_OPTIONS: OrgRole[] = ["owner", "guide", "member", "viewer"];

export function MembersPanel({
  orgSlug,
  members,
  currentUserId,
  isOwner,
}: {
  orgSlug: string;
  members: MemberRow[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

  async function changeRole(userId: string, role: OrgRole) {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/org/${orgSlug}/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not update role");
        return;
      }
      router.refresh();
    } finally {
      setBusyUserId(null);
    }
  }

  async function remove(userId: string) {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/org/${orgSlug}/members/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not remove member");
        return;
      }
      router.refresh();
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li
            key={m.userId}
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {m.displayName || m.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && m.userId !== currentUserId ? (
                <>
                  <Select
                    value={m.role}
                    onValueChange={(v) => changeRole(m.userId, v as OrgRole)}
                    disabled={busyUserId === m.userId}
                  >
                    <SelectTrigger size="sm" className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyUserId === m.userId}
                    onClick={() => remove(m.userId)}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Badge variant="outline">{m.role}</Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
