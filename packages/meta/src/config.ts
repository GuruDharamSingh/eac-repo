/**
 * Meta (Facebook/Instagram) Graph API configuration.
 *
 * Server-only. Nothing in this package may be imported into a client bundle:
 * every value here is a credential, and a Page access token is a bearer token
 * that can post as the Page until it is revoked.
 *
 * The network holds ONE Page today (arts-collective.com's), so the token lives
 * in the environment rather than in a per-org table. That is a deliberate
 * first cut, not a ceiling: every function in this package takes the page id
 * and token as arguments, and `pageFromEnv()` is the only place that reads the
 * environment. Moving to per-org connections later means writing a different
 * loader, not rewriting the Graph calls.
 *
 * Following commit 1d63c1b, a missing secret fails loudly. A Graph call made
 * with an empty token does not fail loudly — it returns a 400 whose message is
 * about the *object* being unreachable, which reads like a permissions problem
 * and sends you looking in the wrong place.
 */

/**
 * Graph API version, pinned.
 *
 * Meta deprecates a version roughly two years after release and an unpinned
 * call silently follows whatever the app's default is, so a Page post that
 * worked yesterday can start failing because someone changed a dropdown in the
 * App Dashboard. Confirm the current version there and set META_GRAPH_VERSION
 * to match; the default below is a floor, not a recommendation.
 */
export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaAppConfig {
  appId: string;
  appSecret: string;
}

export interface PageTarget {
  /** Numeric Page id. */
  pageId: string;
  /** A PAGE access token — not a user token. See tokens.ts for the difference. */
  accessToken: string;
  /**
   * The Instagram professional account linked to this Page, when there is one.
   * Absent means "this Page has no Instagram", which is a normal state, not an
   * error — `postToInstagram` refuses rather than guessing.
   */
  instagramUserId?: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Meta publishing needs it; see packages/meta/README.md.`
    );
  }
  return value;
}

/** App credentials, for token exchange and appsecret_proof. */
export function appFromEnv(): MetaAppConfig {
  return { appId: required('META_APP_ID'), appSecret: required('META_APP_SECRET') };
}

/** The Page this deployment publishes to. */
export function pageFromEnv(): PageTarget {
  return {
    pageId: required('META_PAGE_ID'),
    accessToken: required('META_PAGE_ACCESS_TOKEN'),
    instagramUserId: process.env.META_INSTAGRAM_USER_ID || undefined,
  };
}

/**
 * Whether publishing is configured at all.
 *
 * Callers use this to hide the "also post to Facebook" control rather than
 * offering a button that throws. Deliberately does not touch the network: an
 * env check is synchronous and a UI decision should not wait on Meta.
 */
export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN);
}
