"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unpresentArtworkAction } from "../actions";

export function RemovePresentedButton({ storeId, artworkId }: { storeId: string; artworkId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
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
    </Button>
  );
}
