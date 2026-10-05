"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setDetailPageAction } from "@/lib/puck/event-actions";

/**
 * Editors' switch on a gathering's page: give it the designed detail page (the
 * `event-detail` template, with a Talk room made for it) or take it back to
 * the plain page. See lib/puck/event-actions.ts.
 */
export function EventPageToggle({ threadId, on }: { threadId: string; on: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await setDetailPageAction(threadId, !on);
          setBusy(false);
          if ("error" in res) setError(res.error);
          else router.refresh();
        }}
        className="border border-input bg-background px-3 py-1.5 text-sm hover:border-[hsl(var(--primary))] disabled:opacity-60"
      >
        {busy ? "Saving…" : on ? "Use the plain page" : "Give this a detail page"}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
