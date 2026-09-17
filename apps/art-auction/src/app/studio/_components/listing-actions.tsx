"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishArtworkAction, archiveArtworkAction } from "../actions";

type Status = "draft" | "available" | "reserved" | "sold" | "archived";

/**
 * Inline quick status controls for an artwork row in the studio store.
 * Maps each status to its sensible next action:
 *   draft / archived → Publish (list it)
 *   available        → Auction (put it up) · Unlist (archive)
 *   at auction       → link to the lot (a piece at auction is locked)
 * Sold and reserved pieces are locked (no quick action).
 */
export function ListingActions({
  artworkId,
  status,
  openLotId,
}: {
  artworkId: string;
  status: Status;
  /** The open (scheduled/live) lot on this piece, if any. */
  openLotId?: string | null;
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

  if (openLotId) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href={`/lots/${openLotId}`}>At auction →</Link>
      </Button>
    );
  }

  if (status === "draft" || status === "archived") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(publishArtworkAction, "Published to the storefront.")}
      >
        {pending ? "…" : status === "archived" ? "Re-list" : "Publish"}
      </Button>
    );
  }

  if (status === "available") {
    return (
      <>
        <Button asChild variant="outline" size="sm">
          <Link href={`/studio/artworks/${artworkId}/auction`}>Auction</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(archiveArtworkAction, "Unlisted from the storefront.")}
        >
          {pending ? "…" : "Unlist"}
        </Button>
      </>
    );
  }

  return null;
}
