"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";

/** Empty state for an org that has no Deck board yet. */
export function ProvisionBoard({ canProvision }: { canProvision: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function provision() {
    setPending(true);
    const res = await fetch("/api/pipeline/provision", { method: "POST" });
    setPending(false);
    if (!res.ok) {
      toast.error("Could not create the board.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <h2 className="font-serif text-xl">No board yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {canProvision
          ? "Create the group's kanban board. It lives in the group's Nextcloud Deck, starts with To do / Doing / Done, and is shared only with members who have connected a Nextcloud account."
          : "An owner or guide can set up the group's board."}
      </p>
      {canProvision && (
        <Button className="mt-6" disabled={pending} onClick={() => void provision()}>
          {pending ? "Creating…" : "Create the board"}
        </Button>
      )}
    </div>
  );
}
