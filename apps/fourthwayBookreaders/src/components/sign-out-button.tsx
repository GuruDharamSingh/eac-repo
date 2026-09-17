"use client";

import { useState } from "react";
import { withBase } from "@/lib/base-path";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(withBase("/api/auth/logout"), { method: "POST" }).catch(() => null);
        window.location.href = withBase("/");
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
