"use client";

import * as React from "react";
import { signOut } from "@elkdonis/auth-client";

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
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={
        className ??
        "inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
      }
    >
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
