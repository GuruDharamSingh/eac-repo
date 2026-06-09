"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { publishArtworkAction, archiveArtworkAction } from "../actions";

type Status = "draft" | "available" | "reserved" | "sold" | "archived";

/**
 * Inline quick status controls for an artwork row in the studio store.
 * Maps each status to its sensible next action:
 *   draft / archived → Publish (list it)   ·   available → Unlist (archive)
 * Sold and reserved pieces are locked (no quick action).
 */
export function ListingActions({
  artworkId,
  status,
}: {
  artworkId: string;
  status: Status;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function run(
    action: (id: string) => Promise<{ ok: boolean; error?: string }>,
    successMsg: string
  ) {
    setPending(true);
    try {
      const res = await action(artworkId);
      if (res.ok) {
        toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    } finally {
      setPending(false);
    }
  }

  const btn =
    "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50";

  if (status === "draft" || status === "archived") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => run(publishArtworkAction, "Published to the storefront.")}
        className={btn}
      >
        {pending ? "…" : status === "archived" ? "Re-list" : "Publish"}
      </button>
    );
  }

  if (status === "available") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => run(archiveArtworkAction, "Unlisted from the storefront.")}
        className={btn}
      >
        {pending ? "…" : "Unlist"}
      </button>
    );
  }

  return null;
}
