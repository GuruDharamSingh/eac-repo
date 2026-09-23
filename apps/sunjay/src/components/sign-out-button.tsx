"use client";

import { useState } from "react";
import { signOut } from "@elkdonis/auth-client";
import { Button } from "@elkdonis/primitives";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
        } finally {
          // Hard navigation so server components re-read the cleared session
          // rather than serving the cached signed-in shell.
          window.location.href = "/";
        }
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
