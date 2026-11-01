"use client";

import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import { mirrorLoginHref } from "@elkdonis/auth-client";
import "@elkdonis/cms-ui/baroque-signup.css";

/**
 * The network's Baroque sign-up frame on the landing page, on its own below
 * "Who we are". Same wiring as components/login-form.tsx: this app's own
 * auth routes (they join `ifac` as viewer) and the mirror trip through the
 * network host afterwards.
 *
 * Copy (developer, 2026-10-10): no sigil, "Join the / Arts Collective Platform",
 * no subtitle, submit "Enter the Arts Collective". The account is a platform
 * (network) account: never "IFAC account" or "Join IFAC"; no "RSVP" or "free".
 */
export function JoinFrame({ next = "/hub" }: { next?: string; seriesTitle?: string | null }) {
  return (
    <div className="ifs-join">
      <BaroqueSignup
        initialMode="signup"
        showSigil={false}
        title={
          <>
            Join the
            <br />
            Arts Collective Platform
          </>
        }
        submitLabel={{ signup: "Enter the Arts Collective", signin: "Enter the Arts Collective" }}
        signupSuccessText="Your account is live. Check your email for a welcome message."
        googleRedirectTo={next}
        onSuccess={() => {
          window.location.href = mirrorLoginHref(window.location.origin, next);
        }}
      />
    </div>
  );
}
