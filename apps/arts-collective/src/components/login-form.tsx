"use client";

import { useSearchParams } from "next/navigation";
// From @elkdonis/cms-ui, not @elkdonis/ui: the component is Mantine-free
// either way, but the ui barrel declares Mantine, so importing through it
// pulls Mantine into an app that deliberately does without it.
import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import "@elkdonis/cms-ui/baroque-signup.css";

/**
 * Shared platform-wide signup/signin card — same component used on
 * inner-gathering's /login and the main landing page. Auth itself goes
 * through @elkdonis/auth-client's useAuthForm (this app's own
 * /api/auth/login + /api/auth/signup routes, unchanged); only the
 * org-join-after-auth redirect below is arts-collective-specific.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get("org");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  return (
    <div className="mx-auto max-w-md py-16">
      <BaroqueSignup
        key={initialMode}
        initialMode={initialMode}
        subtitle={
          orgSlug
            ? `One account works across the whole network — you're joining ${orgSlug} now.`
            : "One account across the whole network. Artists, facilitators, and members share a single sign-in — your role in each space is set separately."
        }
        onSuccess={async ({ mode }) => {
          if (orgSlug) {
            try {
              await fetch("/api/org/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: orgSlug }),
              });
            } catch {
              // non-fatal — user can still proceed
            }
            const host = window.location.host;
            const rootHost = host.replace(/^[^.]+\./, "");
            const subdomainHost = host.startsWith(`${orgSlug}.`)
              ? host
              : `${orgSlug}.${rootHost === host ? host : rootHost}`;
            window.location.href = `${window.location.protocol}//${subdomainHost}/`;
            return;
          }

          window.location.href = mode === "signup" ? "/hub/elkdonis" : "/hub";
        }}
      />
    </div>
  );
}
