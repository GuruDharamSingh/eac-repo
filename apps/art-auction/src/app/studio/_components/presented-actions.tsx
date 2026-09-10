"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { unpresentArtworkAction } from "../actions";

export function RemovePresentedButton({ storeId, artworkId }: { storeId: string; artworkId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      onClick={async () => {
        setPending(true);
        try {
          const res = await unpresentArtworkAction(storeId, artworkId);
          if (!res.ok) return toast.error(res.error ?? "Could not remove it.");
          toast.success("Removed from your front.");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
