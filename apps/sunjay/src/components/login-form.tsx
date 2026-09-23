"use client";

import { useSearchParams } from "next/navigation";
// From @elkdonis/cms-ui, not @elkdonis/ui: the component is Mantine-free
// either way, but the ui barrel declares Mantine, so importing through it
// pulls Mantine into an app that deliberately does without it.
import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import { mirrorLoginHref } from "@elkdonis/auth-client";
import "@elkdonis/cms-ui/baroque-signup.css";
import { siteConfig } from "@/config/site";

/**
 * The shared platform signup/signin card — the same component the rest of the
 * network uses. It is Mantine-free by construction, and it is imported from
 * @elkdonis/cms-ui so that nothing here pulls Mantine in.
 *
 * Auth goes through useAuthForm inside the component, which posts to THIS
 * app's /api/auth/login and /api/auth/signup (avoiding CORS). Google uses the
 * PKCE flow and lands on /api/auth/callback.
 *
 * A login here is a network login: one GoTrue instance keyed on email serves
 * every site. Signing in does not by itself grant any role on this site —
 * that comes from user_organizations (see src/lib/auth.ts).
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <BaroqueSignup
        key={initialMode}
        initialMode={initialMode}
        title={siteConfig.orgName}
        subtitle="Sign in to RSVP for gatherings. One account works across the whole Elkdonis network."
        googleRedirectTo={next ?? "/"}
        onSuccess={(result) => {
          // A new account lands on its center (CENTER_PAGE_BRIEF, decision 8);
          // a returning sign-in goes back where it was. Either way, the trip
          // runs through the network host once so a LATER visit to a
          // different site on the collective finds the session already
          // there (mirrorLoginHref).
          const finalPath = next ?? (result.mode === "signup" ? "/center" : "/");
          window.location.href = mirrorLoginHref(window.location.origin, finalPath);
        }}
      />
    </div>
  );
}
