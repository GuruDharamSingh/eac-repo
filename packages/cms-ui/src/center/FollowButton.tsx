"use client";

import * as React from "react";

/**
 * Follow / Following, on the org's card.
 *
 * POST to the host's endpoint writes a viewer row; DELETE removes it. The
 * word is always "follow" — never "viewer" — and a member+ never sees this
 * control at all, because unfollowing would have to mean demotion.
 */
export function FollowButton({
  endpoint,
  following,
  signedIn,
  loginHref,
  orgName,
}: {
  endpoint: string;
  following: boolean;
  signedIn: boolean;
  loginHref: string;
  orgName: string;
}) {
  const [state, setState] = React.useState(following);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!signedIn) {
    return (
      <a className="eac-center-btn eac-center-btn--primary" href={loginHref}>
        Sign in to follow
      </a>
    );
  }

  async function toggle() {
    const next = !state;
    setState(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: next ? "POST" : "DELETE" });
      if (!res.ok) {
        setState(!next);
        setError("Could not save that.");
      }
    } catch {
      setState(!next);
      setError("Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="eac-center-follow">
      <button
        type="button"
        className={`eac-center-btn${state ? "" : " eac-center-btn--primary"}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={state}
        aria-label={state ? `Following ${orgName}` : `Follow ${orgName}`}
      >
        {state ? "Following" : "Follow"}
      </button>
      {error && <span className="eac-center-error">{error}</span>}
    </span>
  );
}
