"use client";

import { useSearchParams } from "next/navigation";
// From @elkdonis/cms-ui, not @elkdonis/ui — see amrit-canada/ifac's own
// login-form.tsx: the component is Mantine-free, and importing it this way
// keeps Mantine out of the shared auth bundle.
import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import { mirrorLoginHref } from "@elkdonis/auth-client";
import "@elkdonis/cms-ui/baroque-signup.css";
import { siteConfig } from "@/config/site";

/**
 * The shared platform signup/signin card, same as every other site on the
 * network. A login here is a network login — one GoTrue instance keyed on
 * email — but signing in grants no role on this site by itself; that comes
 * from user_organizations (see src/lib/auth.ts). In practice this site has
 * one editor (Dana), already seeded as `owner` by migration 125.
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
        subtitle="Sign in to manage this site. One account works across the whole Elkdonis network."
        googleRedirectTo={next ?? "/"}
        onSuccess={(result) => {
          const finalPath = next ?? "/";
          window.location.href = mirrorLoginHref(window.location.origin, finalPath);
        }}
      />
    </div>
  );
}
