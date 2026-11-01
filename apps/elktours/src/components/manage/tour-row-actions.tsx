"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setTourPinnedAction, setTourStatusAction } from "@/lib/tour-actions";
import { Button } from "@elkdonis/primitives";

export function TourRowActions({ id, slug, status, pinned }: { id: string; slug: string; status: string; pinned: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Failed");
      else router.refresh();
    });
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      <Button asChild variant="ghost" size="sm"><Link href={`/tours/${slug}`}>View</Link></Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setTourPinnedAction(id, !pinned))}>
        {pinned ? "Unfeature" : "Feature"}
      </Button>
      {status === "published" ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setTourStatusAction(id, "draft"))}>Unpublish</Button>
      ) : (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setTourStatusAction(id, "published"))}>Publish</Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm("Archive this tour? It leaves the site; its bookings are kept.")) run(() => setTourStatusAction(id, "archived"));
        }}
      >
        Archive
      </Button>
    </span>
  );
}
