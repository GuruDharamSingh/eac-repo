"use client";

import { useState } from "react";
import { signOut } from "@elkdonis/auth-client";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="ad-nav-link"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        // Full navigation so the server re-reads the cleared session cookie.
        window.location.assign("/");
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
