"use client";

import { useSearchParams } from "next/navigation";
// From @elkdonis/cms-ui, not @elkdonis/ui: the component is Mantine-free
// either way, but the ui barrel declares Mantine, so importing through it
// pulls Mantine into an app that deliberately does without it.
import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import "@elkdonis/cms-ui/baroque-signup.css";

/**
 * The shared platform signup/signin card (same component amrit-canada uses)
 * — real account creation, password login, and Google OAuth all in one,
 * posting to THIS app's own /api/auth/login, /api/auth/signup and
 * /api/auth/callback (all now scoped to join 'ifac', not the network
 * defaults — see those routes' comments).
 *
 * Replaces a hand-rolled login-only form that had no signup path at all —
 * the public "Join IFAC list" form on the homepage only ever wrote to
 * `contacts` (a mailing-list interest form), never created a real account.
 * A signed-in member is what lets someone claim their own roster profile.
 *
 * A login here is a network login: one GoTrue instance keyed on email serves
 * every site. Signing in does not by itself grant any role on this site —
 * that comes from user_organizations (see src/lib/data.ts's canManageIfac).
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  return (
    <BaroqueSignup
      key={initialMode}
      initialMode={initialMode}
      title="IFAC"
      subtitle="Sign in to manage the site, or create an account to claim your artist or dealer profile."
      googleRedirectTo={next ?? "/hub"}
      onSuccess={() => {
        window.location.href = next ?? "/hub";
      }}
    />
  );
}
