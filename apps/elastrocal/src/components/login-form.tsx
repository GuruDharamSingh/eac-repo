"use client";

import { useSearchParams } from "next/navigation";
// From @elkdonis/cms-ui, not @elkdonis/ui: the ui barrel declares Mantine.
import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import "@elkdonis/cms-ui/baroque-signup.css";
import { withBase } from "@/lib/base-path";

/**
 * The shared network signup/sign-in card. Auth posts to THIS app's
 * /api/auth/login and /api/auth/signup; Google uses PKCE and lands on
 * /api/auth/callback. One account works across every Elkdonis site.
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
        title="Elastrocal"
        subtitle="You don't need an account to calculate a chart — only to keep one across devices. One account works across the whole Elkdonis network."
        googleRedirectTo={withBase(next ?? "/charts")}
        onSuccess={() => {
          window.location.href = withBase(next ?? "/charts");
        }}
      />
    </div>
  );
}
