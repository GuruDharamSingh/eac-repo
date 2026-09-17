"use client";

import * as React from "react";
import { signOut } from "@elkdonis/auth-client";
import { Button } from "@/components/ui/button";

/**
 * Signs the user out via the shared auth-client helper (POST /api/auth/logout)
 * and does a full-page nav home so the cleared session cookie takes effect.
 */
export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = React.useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await signOut();
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleLogout}
      disabled={pending}
      className={className}
    >
      {pending ? "Signing out…" : "Log out"}
    </Button>
  );
}
