"use client";

import { useState, useTransition } from "react";
import { redeemClaimAction } from "@/lib/claim-actions";

/** Confirm the hand-over. On success, a hard navigation to /manage so every server component reads the new role. */
export function ClaimConfirm({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <div className="ktp-m-actions" style={{ flexDirection: "column", alignItems: "flex-start" }}>
      <button
        type="button"
        className="ktp-btn"
        disabled={pending || Boolean(done)}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await redeemClaimAction(token).catch(() => null);
            if (!r || !r.ok) return setError(r?.message ?? "That didn't work. Nothing was changed; please try again.");
            setDone(r.message);
            window.location.href = "/manage?claimed=1";
          })
        }
      >
        {pending ? "Handing over…" : done ? "Done" : "Yes, make me the owner"}
      </button>
      {done ? (
        <p className="ktp-m-msg" data-ok="true" role="status">
          {done}
        </p>
      ) : null}
      {error ? (
        <p className="ktp-m-msg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
