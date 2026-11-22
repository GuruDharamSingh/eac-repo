"use client";

import { BaroqueSignup } from "@elkdonis/cms-ui/auth";
import "./offering-signin.css";

/**
 * The right-hand panel of the offerings card when it holds a sign-in form instead of the RSVP (offerings-band's
 * `panel` setting, 2026-11-21). It is the site's one sign-in component, the same BaroqueSignup the Join section and
 * /login use, so it posts to this app's /api/auth/login and /api/auth/signup and handles Google and the Turnstile
 * check itself: nothing here touches a password. The card draws it only for someone who is not signed in.
 *
 * Signing in comes back to this page (a reload), so the same card then shows their RSVP.
 */
export function OfferingSignIn() {
  return (
    <div className="ig-offer-signin-box">
      <BaroqueSignup
        initialMode="signin"
        title="Sign in to come"
        subtitle="One account works across the whole Arts Collective network."
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
