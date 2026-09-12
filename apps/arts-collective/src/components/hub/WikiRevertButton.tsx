"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { revertWikiPageAction } from "@/lib/wiki-actions";
import { Button } from "@/components/ui/button";

type Props = {
  threadId: string;
  revisionId: string;
};

export function WikiRevertButton({ threadId, revisionId }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onRevert() {
    if (!confirm("Revert the page to this version? This is saved as a new edit, not undone.")) {
      return;
    }
    setPending(true);
    try {
      const result = await revertWikiPageAction(threadId, revisionId);
      if (result.ok === false) {
        toast.error(result.error);
        return;
      }
      toast.success("Reverted.");
      router.push(`/hub/wiki/${result.slug}`);
      router.refresh();
    } catch (err) {
      console.error("[WikiRevertButton] revert failed:", err);
      toast.error("Revert failed — check the browser console for details.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onRevert} disabled={pending}>
      {pending ? "Reverting…" : "Revert to this"}
    </Button>
  );
}
