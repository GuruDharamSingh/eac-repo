"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveApplicationAction,
  rejectApplicationAction,
} from "./actions";

export function ApplicationActions({ artistUserId }: { artistUserId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function approve() {
    setPending(true);
    try {
      const res = await approveApplicationAction(artistUserId);
      if (!res.ok) return toast.error(res.error ?? "Failed.");
      toast.success("Artist approved.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function reject() {
    if (!reason.trim()) return toast.error("Enter a reason.");
    setPending(true);
    try {
      const res = await rejectApplicationAction(artistUserId, reason);
      if (!res.ok) return toast.error(res.error ?? "Failed.");
      toast.success("Application declined.");
      setRejecting(false);
      setReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-[2px] focus:ring-ring/50"
          placeholder="Reason for declining"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reject}
            disabled={pending}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-60"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={approve}
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => setRejecting(true)}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Decline
      </button>
    </div>
  );
}
