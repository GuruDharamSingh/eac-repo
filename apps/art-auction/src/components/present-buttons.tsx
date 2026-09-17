"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { presentArtworkAction, unpresentArtworkAction } from "@/app/studio/actions";

export interface PresentOption {
  storeId: string;
  name: string;
  presented: boolean;
}

/**
 * "Show this piece in my front." Rendered on a piece for anyone who runs a
 * store other than the one selling it — typically an organisation's owner or
 * manager curating what their front shows. Presenting copies nothing: the
 * artist still sells it and is still paid; the front is the window.
 */
export function PresentButtons({
  artworkId,
  options,
}: {
  artworkId: string;
  options: PresentOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function toggle(o: PresentOption) {
    setPending(o.storeId);
    try {
      const res = o.presented
        ? await unpresentArtworkAction(o.storeId, artworkId)
        : await presentArtworkAction(o.storeId, artworkId);
      if (!res.ok) return toast.error(res.error ?? "Could not update the front.");
      toast.success(o.presented ? `Removed from ${o.name}.` : `Now showing in ${o.name}.`);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-border p-3 text-sm">
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Your fronts</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.storeId}
            type="button"
            variant={o.presented ? "default" : "outline"}
            size="sm"
            disabled={pending === o.storeId}
            onClick={() => void toggle(o)}
          >
            {pending === o.storeId ? "…" : o.presented ? `Showing in ${o.name} ✓` : `Show in ${o.name}`}
          </Button>
        ))}
      </div>
    </div>
  );
}
