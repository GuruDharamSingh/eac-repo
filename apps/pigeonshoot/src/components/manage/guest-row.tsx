"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setGuestBlocked } from "@/lib/manage/actions";
import type { GuestRow as GuestRowData } from "@/lib/manage/data";

export function GuestRow({ guest }: { guest: GuestRowData }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const blocking = !guest.isBlocked;
    const reason = blocking
      ? prompt("Why block this contributor? (shown to nobody, kept for your reference)") ?? ""
      : "";
    if (blocking && reason === null) return;

    startTransition(async () => {
      const res = await setGuestBlocked({
        guestId: guest.id,
        blocked: blocking,
        reason: reason || null,
      });
      if (res.ok) toast.success(blocking ? "Blocked." : "Unblocked.");
      else toast.error(res.error ?? "That didn't work.");
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-[12rem] flex-1">
        <p className="font-medium">
          {guest.handle ?? guest.displayName}
          {guest.linked && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              linked to an account
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {guest.submissionCount} {guest.submissionCount === 1 ? "card" : "cards"} · last seen{" "}
          {new Date(guest.lastSeenAt).toLocaleDateString()}
        </p>
        {guest.isBlocked && guest.blockedReason && (
          <p className="mt-1 text-xs text-destructive">{guest.blockedReason}</p>
        )}
      </div>

      <Button
        size="sm"
        variant={guest.isBlocked ? "outline" : "ghost"}
        disabled={pending}
        onClick={toggle}
      >
        {guest.isBlocked ? "Unblock" : "Block"}
      </Button>
    </li>
  );
}
