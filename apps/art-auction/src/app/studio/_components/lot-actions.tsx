"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelLotAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function LotActions({ lotId, bidCount }: { lotId: string; bidCount: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  if (bidCount > 0) return null;

  async function withdraw() {
    setPending(true);
    try {
      const res = await cancelLotAction(lotId);
      if (!res.ok) return toast.error(res.error ?? "Could not withdraw.");
      toast.success("Auction withdrawn.");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Withdraw
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Withdraw this auction?"
        description="The piece stays listed for buy-now."
        confirmLabel="Withdraw"
        tone="destructive"
        pending={pending}
        onConfirm={() => void withdraw()}
      />
    </>
  );
}
