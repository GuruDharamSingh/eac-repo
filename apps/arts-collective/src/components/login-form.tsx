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
/**
 * Where to go after signing in, from `?next=`. A path stays on this site. An
 * absolute URL is honoured only on this host or one of its subdomains
 * (forum.arts-collective.com, an org's subdomain) and goes through
 * /api/auth/handoff so the session travels with the person — a host-only
 * cookie set here would not. Anything else is ignored: not an open redirect.
 */
export function returnTo(next: string | null): string | null {
  if (!next) return null;
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  try {
    const u = new URL(next);
    const here = window.location.hostname.toLowerCase();
    const root = here.replace(/^www\./, "");
    const host = u.hostname.toLowerCase();
    if (u.protocol !== window.location.protocol && u.protocol !== "https:") return null;
    if (host === here || host === root || host.endsWith(`.${root}`)) {
      return `/api/auth/handoff?to=${encodeURIComponent(u.toString())}`;
    }
  } catch { /* not a URL */ }
  return null;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get("org");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const next = searchParams.get("next");

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

          const back = returnTo(next);
          if (back) {
            window.location.href = back;
            return;
          }
          window.location.href = mode === "signup" ? "/hub/elkdonis" : "/hub";
        }}
      />
    </div>
  );
}
