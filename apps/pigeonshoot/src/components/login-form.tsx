"use client";

import { useSearchParams } from "next/navigation";
import { BaroqueSignup } from "@elkdonis/ui";
import "@elkdonis/ui/eac-theme.css";

/**
 * The shared platform signup/signin card — the same component the rest of the
 * network uses. It is Mantine-free by construction, which is why it's the one
 * thing this app still imports from @elkdonis/ui.
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
        title="Pigeonshoot"
        subtitle="You don't need an account to post a pigeon — sign in only if you want your cards tied to a name you keep. One account works across the whole Elkdonis network."
        googleRedirectTo={next ?? "/"}
        onSuccess={() => {
          window.location.href = next ?? "/";
        }}
      />
    </div>
  );
}
