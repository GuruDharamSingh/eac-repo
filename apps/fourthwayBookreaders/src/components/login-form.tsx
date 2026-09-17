"use client";

import { useSearchParams } from "next/navigation";
// From @elkdonis/cms-ui, not @elkdonis/ui: the component is Mantine-free either
// way, but the ui barrel declares Mantine, and importing through it would pull
// Mantine into an app that deliberately does without it.
import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import { mirrorLoginHref } from "@elkdonis/auth-client";
import "@elkdonis/cms-ui/baroque-signup.css";
import { siteConfig } from "@/config/site";
import { withBase } from "@/lib/base-path";

/**
 * The shared platform sign-in card. It posts to THIS app's /api/auth/* routes
 * (avoiding CORS); Google uses PKCE and lands on /api/auth/callback.
 *
 * A login here is a network login — one GoTrue instance serves every site.
 * Signing in grants no role by itself; that comes from user_organizations.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "56px 20px" }}>
      <BaroqueSignup
        key={initialMode}
        initialMode={initialMode}
        title={siteConfig.orgName}
        subtitle="Sign in to RSVP for a reading and follow the circle. One account works across the whole Elkdonis network."
        googleRedirectTo={withBase(next ?? "/")}
        onSuccess={(result) => {
          // A new account lands on its center; a returning sign-in goes back
          // where it was. Either way the trip runs through the network host
          // once, so a later visit to another site finds the session there.
          const finalPath = next ?? (result.mode === "signup" ? "/center" : "/");
          window.location.href = mirrorLoginHref(window.location.origin, withBase(finalPath));
        }}
      />
    </div>
  );
}
