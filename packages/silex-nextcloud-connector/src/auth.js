"use strict";

/**
 * Token redemption against the arts-collective bridge.
 *
 * The browser arrives at Silex with `?t=<token>` after being redirected from
 * the owner-gated /edit/{slug} route. We redeem the token exactly once via
 * GET /api/silex/auth?token=... and stash the resulting per-user Nextcloud
 * credentials and paths in the express session.
 *
 * Subsequent connector calls read from session — the token is never used twice.
 */

const SESSION_KEY = "nextcloudStorage";

function getQueryParam(req, name) {
  const fromQuery = req.query && req.query[name];
  if (typeof fromQuery === "string") return fromQuery;
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === "string") {
    return fromQuery[0];
  }

  try {
    const url = new URL(req.originalUrl || req.url || "/", "http://silex.local");
    return url.searchParams.get(name);
  } catch {
    return null;
  }
}

function getArtsInternalUrl() {
  const url =
    process.env.ARTS_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://arts-collective:3007";
  return url.replace(/\/+$/, "");
}

async function redeemToken(token) {
  const base = getArtsInternalUrl();
  const res = await fetch(`${base}/api/silex/auth?token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `redeemToken failed: ${res.status} ${res.statusText} ${body}`
    );
  }
  return res.json();
}

function getStored(session) {
  return session ? session[SESSION_KEY] || null : null;
}

function setStored(session, value) {
  if (!session) return;
  session[SESSION_KEY] = value;
}

function clearStored(session) {
  if (!session) return;
  session[SESSION_KEY] = null;
}

/**
 * Express middleware: if `?t=` is present on a GET, redeem once, stash in
 * session, and 302-redirect to the same URL without `t` (so the token never
 * lingers in browser history or referer headers).
 *
 * Idempotent: if the session is already populated, we skip redemption and
 * just clean the URL — this protects against double-loads of the editor
 * with a previously-consumed token (tokens are single-use).
 *
 * Fail loud: if redemption fails AND the session is empty, we serve a 401
 * page rather than silently dropping the user into a logged-out editor.
 */
function tokenRedeemMiddleware() {
  return async function eacTokenRedeem(req, res, next) {
    if (req.method !== "GET") return next();
    const token = getQueryParam(req, "t");
    if (!token) return next();

    const url = new URL(req.originalUrl, "http://placeholder");
    url.searchParams.delete("t");
    const cleaned = `${url.pathname}${url.search ? url.search : ""}`;

    // Already logged in via this session? Just strip the (likely stale) token.
    if (getStored(req.session)) {
      return res.redirect(302, cleaned);
    }

    try {
      const creds = await redeemToken(token);
      setStored(req.session, {
        ncBaseUrl: creds.ncBaseUrl,
        ncUser: creds.ncUser,
        ncPass: creds.ncPass,
        projectPath: creds.projectPath,
        publishedPath: creds.publishedPath,
        slug: creds.slug,
        orgId: creds.orgId,
        userId: creds.userId,
        redeemedAt: Date.now(),
      });
    } catch (err) {
      console.warn(
        `[silex-nextcloud-connector] token redemption failed: ${err.message}`
      );
      // No prior session + bad token = doomed editor session. Bail with a
      // clear 401 so the launcher can mint a fresh token.
      res.status(401).type("html").send(
        `<!doctype html><html><body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem;">
          <h1>Editor session expired</h1>
          <p>Your one-time editor token was already used or has expired. Tokens are single-use and valid for 10 minutes.</p>
          <p>Return to the arts-collective hub and re-open the editor to mint a fresh token.</p>
        </body></html>`
      );
      return;
    }

    return res.redirect(302, cleaned);
  };
}

module.exports = {
  SESSION_KEY,
  getStored,
  setStored,
  clearStored,
  redeemToken,
  tokenRedeemMiddleware,
};
