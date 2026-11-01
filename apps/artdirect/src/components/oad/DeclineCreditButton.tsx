"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { declineCreditAction } from "@/lib/credit-actions";

export function DeclineCreditButton({ artworkId }: { artworkId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <span className="eac-credit-decline">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm("Take your name off this piece? The listing stays; it will no longer say you made it.")) return;
          setBusy(true);
          const r = await declineCreditAction(artworkId);
          setBusy(false);
          if (!r.ok) setError(r.error ?? "Could not decline.");
          else router.refresh();
        }}
      >
        {busy ? "…" : "Decline credit"}
      </button>
      {error && <span className="eac-credit-decline__error">{error}</span>}
    </span>
  );
}
