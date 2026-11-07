"use client";

/**
 * Cloudflare Turnstile widget for signup forms that do not use BaroqueSignup
 * (art-auction, artdirect, the series sign-in/up form). Added 2026-11-06.
 *
 * `/api/auth/signup` (packages/auth-server/src/api-routes.ts) refuses a signup
 * without a token whenever the app has TURNSTILE_SECRET_KEY, so every form that
 * posts there must render this when the site key is baked in.
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset. A token is
 * single-use: change `resetSignal` after each signup attempt so a retry gets a
 * fresh one.
 */

import { useEffect, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

/** True when this build carries a Turnstile site key. */
export const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export interface TurnstileFieldProps {
  onToken: (token: string | null) => void;
  /** Change this value to reset the widget (after a signup attempt). */
  resetSignal?: number;
  className?: string;
}

export function TurnstileField({ onToken, resetSignal, className }: TurnstileFieldProps) {
  const ref = useRef<TurnstileInstance | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (resetSignal === undefined || resetSignal === 0) return;
    onToken(null);
    ref.current?.reset();
    // onToken is a state setter in every caller; resetting is keyed on the signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  if (!siteKey) return null;
  return (
    <div className={className}>
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={(token) => onToken(token)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
      />
    </div>
  );
}
