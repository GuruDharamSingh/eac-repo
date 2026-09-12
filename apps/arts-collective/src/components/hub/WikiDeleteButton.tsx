"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { archiveWikiPageAction } from "@/lib/wiki-actions";
import { Button } from "@/components/ui/button";

export function WikiDeleteButton({
  threadId,
  title,
  childCount,
}: {
  threadId: string;
  title: string;
  childCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onDelete() {
    const warning =
      childCount > 0
        ? `\n\n${childCount} page${childCount === 1 ? "" : "s"} sitting under it will move to the top level, not be removed.`
        : "";
    if (!confirm(`Remove "${title}" from the wiki?${warning}`)) return;

    setPending(true);
    try {
      const result = await archiveWikiPageAction(threadId);
      if (result.ok === false) {
        toast.error(result.error);
        return;
      }
      toast.success("Page removed.");
      router.push("/hub/wiki");
      router.refresh();
    } catch (err) {
      console.error("[WikiDeleteButton] archive failed:", err);
      toast.error("Remove failed — check the browser console for details.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onDelete}
      disabled={pending}
      className="text-destructive hover:bg-destructive/10"
    >
      {pending ? "Removing…" : "Remove page"}
    </Button>
  );
}
