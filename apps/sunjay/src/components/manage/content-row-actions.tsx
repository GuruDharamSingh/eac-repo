"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteContentAction,
  setContentStatusAction,
  setStandingMeetingAction,
} from "@/lib/cms/actions";
import { Button } from "@elkdonis/primitives";

interface ContentRowActionsProps {
  threadId: string;
  status: string;
  feedSlug: string | null;
  slug: string;
  isRecurring: boolean;
  hasRsvps: boolean;
  /** Dated threads can lead the hub; writing cannot. */
  isDated: boolean;
  /** Already the one the hub leads with. */
  isStanding: boolean;
}

export function ContentRowActions({
  threadId,
  status,
  feedSlug,
  slug,
  isRecurring,
  hasRsvps,
  isDated,
  isStanding,
}: ContentRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function toggleStatus() {
    startTransition(async () => {
      const next = status === "published" ? "draft" : "published";
      const res = await setContentStatusAction(threadId, next);
      if (res.ok) {
        toast.success(next === "published" ? "Published." : "Moved back to draft.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not update.");
      }
    });
  }

  async function cycle(action: "confirm" | "cancel") {
    setBusy(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/cycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not update.");
        return;
      }
      toast.success(
        action === "confirm"
          ? "Confirmed — the page now says it's on."
          : "Marked cancelled for this cycle."
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function triggerEmail(type: "reminder" | "cancellation") {
    // Emailing a whole list is not undoable, so it asks first.
    const label = type === "reminder" ? "a reminder" : "a cancellation notice";
    if (!confirm(`Send ${label} to everyone who said they're coming?`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/trigger-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not send.");
        return;
      }
      toast.success(
        data.sent > 0 ? `Sent to ${data.sent} ${data.sent === 1 ? "person" : "people"}.` : data.message
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleStanding() {
    startTransition(async () => {
      const res = await setStandingMeetingAction(isStanding ? null : threadId);
      if (res.ok) {
        toast.success(
          isStanding
            ? "No longer the hub's standing gathering."
            : "This now leads the hub."
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not update.");
      }
    });
  }

  function remove() {
    if (!confirm("Take this off the site? It is archived, not deleted: RSVPs are kept, and Publish restores it.")) return;
    startTransition(async () => {
      const res = await deleteContentAction(threadId);
      if (res.ok) {
        toast.success("Removed. Publish restores it.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not remove.");
      }
    });
  }

  const disabled = pending || busy;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} aria-label="Actions">
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/manage/content/${threadId}`}>Edit</Link>
        </DropdownMenuItem>
        {feedSlug && status === "published" && (
          <DropdownMenuItem asChild>
            <Link href={`/${feedSlug}/${slug}`}>View on the site</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={toggleStatus}>
          {status === "published" ? "Move to draft" : "Publish"}
        </DropdownMenuItem>

        {isDated && (
          <DropdownMenuItem onSelect={toggleStanding}>
            {isStanding ? "Stop leading the hub" : "Make this the weekly meeting"}
          </DropdownMenuItem>
        )}

        {isRecurring && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => cycle("confirm")}>
              Confirm this cycle
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => cycle("cancel")}>
              Cancel this cycle
            </DropdownMenuItem>
          </>
        )}

        {hasRsvps && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/manage/content/${threadId}/attendees`}>Who&rsquo;s coming</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => triggerEmail("reminder")}>
              Email a reminder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => triggerEmail("cancellation")}>
              Email a cancellation
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={remove} variant="destructive">
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
