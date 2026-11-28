// Client-side SurfaceActions for the single-offer page: plain fetches to
// routes on the same host. Rights come from the session and the server's own
// checks, never from these arguments.
import type { ActionResult, CheckoutRequest, SurfaceActions } from "@elkdonis/cms-ui/offer-surface";

async function send<T extends object>(url: string, method: string, body?: unknown): Promise<ActionResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && json.error === undefined) return { ok: true, ...(json as T) } as ActionResult<T>;
    const loginHref = res.status === 401 ? "/login?next=" + encodeURIComponent(location.pathname + location.search) : undefined;
    return { ok: false, error: typeof json.error === "string" ? json.error : "That did not work.", ...(loginHref ? { loginHref } : {}) };
  } catch {
    return { ok: false, error: "Could not reach the site. Try again." };
  }
}

/** The auth routes answer `{ error }` with a status on failure and `{ user, session }` on success; no sign-in link is offered (the layer is the sign-in). */
async function authPost<T extends object>(url: string, body: unknown): Promise<ActionResult<T>> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && json.error === undefined) return { ok: true, ...(json as T) } as ActionResult<T>;
    return { ok: false, error: typeof json.error === "string" ? json.error : "That did not work." };
  } catch {
    return { ok: false, error: "Could not reach the site. Try again." };
  }
}

/** `siteSlug` names the org the page belongs to; `ownerId` is the profile id of the site's owner. */
export function makeOfferActions(siteSlug: string, ownerId: string): SurfaceActions {
  return {
    async rsvp(offerKey, input) {
      const id = offerKey.replace(/^thread:/, "");
      const base = `/api/threads/${encodeURIComponent(id)}/rsvp-and-follow`;
      // Guests (no account) are not accepted by this door: it answers 401 with a sign-in link.
      const r = input.going
        ? await send<{ count?: number }>(base, "POST", { receiveEmailNotice: input.remind !== false })
        : await send<{ count?: number }>(base, "DELETE");
      return r.ok ? { ok: true, follows: input.going ? siteSlug : null } : r;
    },
    async follow(profileId, input) {
      // Only the site's own owner can be followed here; other profiles belong to their own sites.
      if (profileId !== ownerId) return { ok: false, error: "Follow this person on their own site." };
      const r = await send<object>(`/api/org/${encodeURIComponent(siteSlug)}/follow`, input.follow ? "POST" : "DELETE");
      return r.ok ? { ok: true as const, following: input.follow } : (r as { ok: false; error: string; loginHref?: string });
    },
    async checkout(input: CheckoutRequest) {
      return send<{ url: string }>("/api/content/checkout", "POST", input);
    },
    // The quick sign-up (layer `join`). The platform's own routes, called on THIS host (the org's subdomain), so
    // the session cookie they set belongs to this host: /api/auth/signup (GoTrue sign-up, a viewer row in `oad`,
    // welcome email; Turnstile token required) and /api/auth/login. Auto-confirm is on in GoTrue, so a session
    // exists at once; if it ever is not, `confirm` is returned and the kit says "Check your email to finish".
    // The org follower row is made by the RSVP / follow routes afterwards, never here.
    async join(input) {
      const r = await authPost<{ session?: unknown }>("/api/auth/signup", {
        email: input.email,
        password: input.password,
        displayName: input.name,
        ...(input.turnstileToken ? { turnstileToken: input.turnstileToken } : {}),
      });
      if (r.ok === false) {
        const taken = /already (been )?registered|already exists/i.test(r.error);
        return { ok: false, error: taken ? 'That email already has an account. Use "I have an account".' : r.error };
      }
      return r.session ? { ok: true, signedIn: true } : { ok: true, signedIn: false, confirm: true };
    },
    async signIn(input) {
      const r = await authPost<{ session?: unknown }>("/api/auth/login", { email: input.email, password: input.password });
      if (r.ok === false) {
        return { ok: false, error: /invalid login credentials/i.test(r.error) ? "That email and password do not match." : /not confirmed/i.test(r.error) ? "Confirm your email first: check your inbox for the link." : r.error };
      }
      return r.session ? { ok: true, signedIn: true } : { ok: false, error: "That did not sign you in. Try again." };
    },
  };
}
