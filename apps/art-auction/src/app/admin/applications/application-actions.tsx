"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  approveApplicationAction,
  rejectApplicationAction,
} from "./actions";

export function ApplicationActions({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function approve() {
    setPending(true);
    try {
      const res = await approveApplicationAction(storeId);
      if (!res.ok) return toast.error(res.error ?? "Failed.");
      toast.success("Store approved.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function reject() {
    if (!reason.trim()) return toast.error("Enter a reason.");
    setPending(true);
    try {
      const res = await rejectApplicationAction(storeId, reason);
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
          className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          placeholder="Reason for declining"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" onClick={reject} disabled={pending}>
            Confirm
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRejecting(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" onClick={approve} disabled={pending}>
        Approve
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setRejecting(true)} disabled={pending}>
        Decline
      </Button>
    </div>
  );
}
