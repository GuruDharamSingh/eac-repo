"use client";

import * as React from "react";
import { useLayer, useSurface } from "../surface/context";
import { TurnstileField, turnstileEnabled } from "../auth/TurnstileField";
import { OfferFrame } from "./OfferFrame";
import { useOfferEnv } from "./env";
import { offerDescriptor, offerProps, offerSurfaceValue, type JoinThen, type OfferFlow, type OfferProps } from "./descriptor";
import { Failure, Field, isEmail } from "./parts";
import type { SurfaceIconKind } from "./icons";
import type { ActionResult } from "./types";

// ============================================================================
// join: the one quick sign-up (lane A, 2026-11-27; Decision 14: "just make it
// sign up to RSVP; we will start there and fall back if needed").
//
// RSVP, Follow, Subscribe and posting in Talk all need an account. Each of them,
// when the visitor is signed out, pushes THIS layer instead of asking for a name
// and an email. The visitor adds a name, an email and a password ("Create
// account"), or switches the same layer to sign-in ("I have an account").
//
//   - The layer below (the one pressed) registers itself in `env.joinFor` with
//     useJoinGate, then pushes `join` with `ctx.then` (what was started) and the
//     flow. On success the host's join/signIn says `signedIn`; the layer tells the
//     env (`setViewer`, so every layer reads the visitor as signed in) and pops
//     ITSELF. The layer below sees `signedIn` flip true while its id is in
//     `joinFor`, and runs its action (the RSVP is recorded, the follow is made)
//     with no second question.
//   - When the host says `confirm` (the email must be confirmed before a session
//     exists) the layer shows "Check your email to finish". Nothing completes
//     there; the host is given `returnTo` (this page with the layer below open) so
//     its confirmation link can land the visitor back on it, signed in, one press
//     from done. (The live network has email auto-confirm on, so today a session
//     exists at once; see the board.)
//   - A host that gives neither `join` nor `signIn` keeps today's behaviour: the
//     layers draw their old forms and the `signInHref` link (useJoinGate.gate false).
//   - `GUEST_RSVP = true` brings the guest-by-email forms of RSVP, Follow and
//     Subscribe back (the fallback Justin named). One line.
// ============================================================================

/**
 * Decision 14 (Justin, 2026-11-27): an RSVP needs an account. Set true to bring back the guest-by-email
 * forms (name and email on RSVP; email on Follow and Subscribe) and the "no account needed" wording.
 */
export const GUEST_RSVP = false;

/** Justin's pitch, one sentence. */
const PITCH = "Be part of the art scene and follow this art via the Arts-Collective Network: just add a password to make an account.";

const DOES_CREATE: Record<JoinThen, string> = {
  rsvp: "To say you're coming, make an account.",
  follow: "To follow, make an account.",
  sub: "To subscribe, make an account.",
  post: "To post, make an account.",
};
const DOES_SIGNIN: Record<JoinThen, string> = {
  rsvp: "Sign in to say you're coming.",
  follow: "Sign in to follow.",
  sub: "Sign in to subscribe.",
  post: "Sign in to post.",
};
const ICON: Record<JoinThen, SurfaceIconKind> = { rsvp: "evt", follow: "fol", sub: "ser", post: "talk" };

/** A shared link carries the flow but not `then`: read it back from the flow. */
function thenFromFlow(flow: OfferFlow | undefined): JoinThen | undefined {
  return flow === "evt" ? "rsvp" : flow === "fol" ? "follow" : flow === "ser" ? "sub" : undefined;
}

/**
 * For the layer that needs an account to finish its action (RSVP, follow, subscribe, talk).
 *   gate    true when the visitor is signed out and the host can make accounts: show no guest form and let
 *           the primary call `ask`.
 *   ask     registers this layer as the one to resume and pushes `join`.
 *   resume  runs (once) when the visitor comes back from `join` signed in: finish the action here.
 */
export function useJoinGate(then: JoinThen, key: string | undefined, flow: OfferFlow | undefined, resume: () => void): { gate: boolean; ask: () => void } {
  const env = useOfferEnv();
  const { push } = useSurface();
  const { id } = useLayer();
  const signedIn = Boolean(env.data.viewer?.signedIn);
  const gate = !GUEST_RSVP && !signedIn && Boolean(env.actions.join || env.actions.signIn);
  const resumeRef = React.useRef(resume);
  resumeRef.current = resume;
  const joinFor = env.joinFor;
  React.useEffect(() => {
    if (signedIn && joinFor.current === id) {
      joinFor.current = null;
      resumeRef.current();
    }
  }, [signedIn, id, joinFor]);
  const ask = React.useCallback(() => {
    joinFor.current = id;
    push(offerDescriptor("join", key, { flow, then }));
  }, [joinFor, id, push, key, flow, then]);
  return { gate, ask };
}

/** This page's address with `?surface=` set to the layer the visitor came from (for a confirmation link). */
function returnAddress(below: ReturnType<typeof offerProps> | null): string | undefined {
  if (typeof window === "undefined") return undefined;
  const u = new URL(window.location.href);
  if (below?.key) u.searchParams.set("surface", offerSurfaceValue(below.layer, below.key, below.ctx?.flow));
  else u.searchParams.delete("surface");
  u.hash = "";
  return u.toString();
}

export function Join({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { pop, close, stack } = useSurface();
  const { depth } = useLayer();
  const then = props.ctx?.then ?? thenFromFlow(props.ctx?.flow);
  const hasJoin = Boolean(env.actions.join);
  const hasSignIn = Boolean(env.actions.signIn);
  const [mode, setMode] = React.useState<"create" | "signin">(hasJoin ? "create" : "signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [token, setToken] = React.useState<string | null>(null);
  const [reset, setReset] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmFor, setConfirmFor] = React.useState<string | null>(null);

  const create = mode === "create";
  const who = then === "follow" ? env.findProfile(props.key)?.name : undefined;
  const lead = then
    ? create
      ? then === "follow" && who
        ? `To follow ${who}, make an account.`
        : DOES_CREATE[then]
      : then === "follow" && who
        ? `Sign in to follow ${who}.`
        : DOES_SIGNIN[then]
    : create
      ? "Make an account to join in."
      : "Sign in to join in.";
  const gk: SurfaceIconKind = then ? ICON[then] : "fol";

  const submit = async () => {
    if (busy) return;
    setError(null);
    const addr = email.trim();
    if (create && !name.trim()) return setError("Add your name.");
    if (!isEmail(addr)) return setError("Add your email address.");
    if (create && password.length < 6) return setError("Choose a password of at least 6 characters.");
    if (!create && !password) return setError("Enter your password.");
    if (create && turnstileEnabled && !token) return setError("Complete the check below first.");
    setBusy(true);
    try {
      let r: ActionResult<{ signedIn: boolean; confirm?: boolean }>;
      if (create) {
        const below = stack[depth - 2];
        const bp = below && below.descriptor.type === "custom" ? offerProps(below.descriptor as Parameters<typeof offerProps>[0]) : null;
        r = await env.actions.join!({ name: name.trim(), email: addr, password, turnstileToken: token ?? undefined, returnTo: returnAddress(bp) });
        if (turnstileEnabled) setReset((n) => n + 1);
      } else {
        r = await env.actions.signIn!({ email: addr, password });
      }
      if (r.ok === false) {
        setError(r.error);
        return;
      }
      if (r.signedIn) {
        env.setViewer({ signedIn: true, name: name.trim() || null, email: addr });
        pop();
        return;
      }
      if (r.confirm) {
        setConfirmFor(addr);
        return;
      }
      setError("That did not sign you in. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (confirmFor) {
    return (
      <OfferFrame gk={gk} kicker="Account" title="Check your email to finish" primary={{ label: "Close", onClick: close }} noThumb>
        <span className="osf-check-disc" aria-hidden>✉</span>
        <span className="osf-doneline">{confirmFor}</span>
        <p className="osf-note">We sent a link. Open it, and you come back to this page signed in, one press from done.</p>
      </OfferFrame>
    );
  }

  const other = create ? hasSignIn : hasJoin;
  return (
    <OfferFrame
      gk={gk}
      kicker="Account"
      title={create ? "Make your account" : "Sign in"}
      status="Arts-Collective Network"
      primary={{ label: busy ? "…" : create ? "Create account" : "Sign in", onClick: submit, disabled: busy }}
      quiet={other ? { label: create ? "I have an account" : "Make an account", onClick: () => { setError(null); setMode(create ? "signin" : "create"); } } : undefined}
      noThumb
    >
      <p className="osf-text osf-join-lead">{lead}</p>
      <p className="osf-note osf-join-pitch">{create ? PITCH : "Your Arts-Collective Network account works here."}</p>
      <div
        className="osf-join-fields"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
      >
        {create ? (
          <div className="osf-two">
            <Field label="YOUR NAME" value={name} onChange={setName} autoComplete="name" />
            <Field label="EMAIL" value={email} onChange={setEmail} type="email" autoComplete="email" />
          </div>
        ) : (
          <Field label="EMAIL" value={email} onChange={setEmail} type="email" autoComplete="email" />
        )}
        <Field label="PASSWORD" value={password} onChange={setPassword} type="password" autoComplete={create ? "new-password" : "current-password"} />
      </div>
      {create && turnstileEnabled && <TurnstileField className="osf-join-ts" onToken={setToken} resetSignal={reset} />}
      <Failure error={error} />
    </OfferFrame>
  );
}
