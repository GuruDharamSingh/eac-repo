"use client";

import { useState } from "react";
import { signOut } from "@elkdonis/auth-client";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/base-path";

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
          // Hard navigation so server components re-read the cleared session.
          window.location.href = withBase("/");
        }
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
