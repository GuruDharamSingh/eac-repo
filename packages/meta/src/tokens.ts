/**
 * Getting from the token Graph API Explorer hands you to one that survives.
 *
 * There are three kinds of token and they are easy to confuse, because they
 * are all opaque strings that start the same way:
 *
 *   short-lived USER token   what the Explorer gives you. ~1-2 hours.
 *   long-lived USER token    exchanged from the above. ~60 days.
 *   PAGE token               read from /me/accounts USING a long-lived user
 *                            token. Does not expire while the user stays an
 *                            admin of the Page and the app keeps its
 *                            permissions — this is the one to store.
 *
 * A Page token derived from a SHORT-lived user token inherits the short life,
 * which is the classic way this integration appears to work for an afternoon
 * and then stops. Hence `mintPageTokens`, which does the exchange first and
 * refuses to skip it.
 *
 * Nothing here is called at request time. It runs once, from scripts/probe.mjs,
 * and its output goes into the environment.
 */

import { graph } from './client';
import type { MetaAppConfig } from './config';

/**
 * Trade a short-lived user token for a long-lived one (~60 days).
 *
 * Idempotent in the sense that matters: passing an already-long-lived token
 * returns another long-lived token rather than failing, so re-running the
 * probe is safe.
 */
export async function exchangeForLongLivedUserToken(
  app: MetaAppConfig,
  shortLivedUserToken: string
): Promise<{ accessToken: string; expiresInSeconds?: number }> {
  const result = await graph<{ access_token: string; expires_in?: number }>({
    path: 'oauth/access_token',
    accessToken: '',
    params: {
      grant_type: 'fb_exchange_token',
      client_id: app.appId,
      client_secret: app.appSecret,
      fb_exchange_token: shortLivedUserToken,
    },
  });
  return { accessToken: result.access_token, expiresInSeconds: result.expires_in };
}

export interface PageGrant {
  id: string;
  name: string;
  accessToken: string;
  /** Permissions this token actually carries — not what you asked for. */
  tasks: string[];
}

/**
 * The Pages this user administers, each with its own Page token.
 *
 * `tasks` is worth reading rather than assuming: a user can administer a Page
 * with, say, only ANALYZE and MODERATE, and the resulting token will fail to
 * publish with a permissions error that names the app rather than the role.
 * CREATE_CONTENT is the one that matters for posting.
 */
export async function listPages(userAccessToken: string, app?: MetaAppConfig): Promise<PageGrant[]> {
  const result = await graph<{
    data: Array<{ id: string; name: string; access_token: string; tasks?: string[] }>;
  }>({
    path: 'me/accounts',
    accessToken: userAccessToken,
    params: { fields: 'id,name,access_token,tasks' },
    appSecret: app?.appSecret,
  });

  return result.data.map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    tasks: page.tasks ?? [],
  }));
}

/**
 * The Instagram professional account linked to a Page, if any.
 *
 * `instagram_business_account` is only populated when the account is a
 * Business or Creator account AND is linked to this Page in Page settings. A
 * personal Instagram account cannot publish through the API at all, so null
 * here is usually a statement about the account type rather than a failure.
 */
export async function getLinkedInstagramAccount(
  pageId: string,
  pageAccessToken: string,
  app?: MetaAppConfig
): Promise<{ id: string; username?: string } | null> {
  const result = await graph<{
    instagram_business_account?: { id: string; username?: string };
  }>({
    path: pageId,
    accessToken: pageAccessToken,
    params: { fields: 'instagram_business_account{id,username}' },
    appSecret: app?.appSecret,
  });
  return result.instagram_business_account ?? null;
}

/**
 * Exchange, then read the Page tokens. The whole setup path in one call.
 */
export async function mintPageTokens(
  app: MetaAppConfig,
  shortLivedUserToken: string
): Promise<{ userToken: string; pages: PageGrant[] }> {
  const { accessToken: userToken } = await exchangeForLongLivedUserToken(
    app,
    shortLivedUserToken
  );
  return { userToken, pages: await listPages(userToken, app) };
}

export interface TokenInfo {
  appId: string;
  type: string;
  isValid: boolean;
  /** Unix seconds; 0 means "does not expire", which is what a Page token shows. */
  expiresAt: number;
  scopes: string[];
}

/**
 * What a token actually is. Worth running before blaming the code: it names
 * the app, the type, the scopes, and the expiry, and settles most of the
 * "why is this 400ing" questions on its own.
 *
 * Needs an app access token (`<id>|<secret>`) to inspect, which is why the app
 * config is required rather than optional.
 */
export async function debugToken(app: MetaAppConfig, token: string): Promise<TokenInfo> {
  const result = await graph<{
    data: {
      app_id: string;
      type: string;
      is_valid: boolean;
      expires_at: number;
      scopes?: string[];
    };
  }>({
    path: 'debug_token',
    accessToken: `${app.appId}|${app.appSecret}`,
    params: { input_token: token },
  });

  return {
    appId: result.data.app_id,
    type: result.data.type,
    isValid: result.data.is_valid,
    expiresAt: result.data.expires_at,
    scopes: result.data.scopes ?? [],
  };
}
