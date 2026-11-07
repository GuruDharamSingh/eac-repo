"use client";

import { useState } from "react";
import { signOut } from "@elkdonis/auth-client";

/** Sign out, then a hard navigation so server components re-read the cleared session (katie's). */
export function SignOutButton({ className, label = "Sign out" }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
        } finally {
          window.location.href = "/";
        }
      }}
    >
      {busy ? "Signing out…" : label}
    </button>
  );
}
