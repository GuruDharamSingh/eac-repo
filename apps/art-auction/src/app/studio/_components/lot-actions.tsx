"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelLotAction } from "../actions";

export function LotActions({ lotId, bidCount }: { lotId: string; bidCount: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  if (bidCount > 0) return null;
  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      onClick={async () => {
        if (!window.confirm("Withdraw this auction? The piece stays listed for buy-now.")) return;
        setPending(true);
        try {
          const res = await cancelLotAction(lotId);
          if (!res.ok) return toast.error(res.error ?? "Could not withdraw.");
          toast.success("Auction withdrawn.");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "…" : "Withdraw"}
    </button>
  );
}
