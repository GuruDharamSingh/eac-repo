"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "../ui/button";

/** Empty state for an org with no Talk room yet. */
export function ProvisionChat({
  canProvision,
  compact = false,
}: {
  canProvision: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function provision() {
    setPending(true);
    setError(false);
    const res = await fetch("/api/chat/provision", { method: "POST" });
    setPending(false);
    if (!res.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div
      className={
        compact
          ? "flex h-80 w-full flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center"
          : "rounded-lg border border-dashed p-10 text-center"
      }
    >
      <MessageSquare className="mb-3 size-6 text-muted-foreground" />
      <h3 className="text-sm font-semibold">No chat room yet</h3>
      <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">
        {canProvision
          ? "Create the group's General Chat. It's a Nextcloud Talk room, so anyone with a Nextcloud account can join it there too."
          : "An owner or guide can set up the group's chat."}
      </p>
      {error && <p className="mt-2 text-xs text-destructive">Could not create the room.</p>}
      {canProvision && (
        <Button className="mt-4" size="sm" disabled={pending} onClick={() => void provision()}>
          {pending ? "Creating…" : "Create the chat room"}
        </Button>
      )}
    </div>
  );
}
