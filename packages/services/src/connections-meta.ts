/**
 * Meta (Facebook/Instagram) and Threads sides of connections.ts (2026-10-29).
 *
 * Unlike YouTube, where each person brings their own OAuth client, these use
 * the collective's registered apps (META_APP_ID/SECRET, THREADS_APP_ID/SECRET).
 * The row's client_id is the app id and client_secret_enc the sealed app
 * secret, so the generic code paths keep working; refresh_token_enc holds the
 * long-lived user token. Facebook Page tokens live in `targets` (migration
 * 217), sealed, one per Page the person administers.
 *
 * Plain fetch, no @elkdonis/meta import: services does not depend on it, and
 * the OAuth calls are a handful of URLs.
 */

const FB_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const FB_DIALOG = `https://www.facebook.com/${FB_VERSION}/dialog/oauth`;
const FB_GRAPH = `https://graph.facebook.com/${FB_VERSION}`;
const TH_AUTH = 'https://threads.net/oauth/authorize';
const TH_GRAPH = 'https://graph.threads.net';

export const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  // Business portfolios: lets a Page assigned through a business be found
  // when /me/accounts is empty (dev, 2026-10-31). Also in the login configuration.
  'business_management',
];
export const THREADS_SCOPES = ['threads_basic', 'threads_content_publish'];

export interface MetaPageTarget {
  id: string;
  name: string;
  /** Sealed Page access token. */
  tokenEnc: string;
  tasks: string[];
  instagramUserId: string | null;
  instagramUsername: string | null;
}

export function metaApp(): { appId: string; appSecret: string } | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}
export function threadsApp(): { appId: string; appSecret: string } | null {
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}

async function call<T>(url: string, init?: RequestInit, who = 'Meta'): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || data?.error) {
    const e = data?.error;
    throw new Error(`${who} said: ${e?.message ?? e?.error_description ?? res.status}${e?.code ? ` (code ${e.code})` : ''}`);
  }
  return data as T;
}

// ── Facebook ────────────────────────────────────────────────────────────────

/**
 * With META_LOGIN_CONFIG_ID set, this is "Facebook Login for Business": the
 * dialog takes the configuration (its permissions and assets) instead of a
 * scope list, and the code exchange returns a business token. Without it,
 * the classic dialog with META_SCOPES.
 */
export function facebookAuthorizeUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const configId = process.env.META_LOGIN_CONFIG_ID;
  const q = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: 'code',
    // Ask again on every connect: a person who ticked no Page the first time
    // gets the Page picker back instead of a silent "already authorised".
    auth_type: 'rerequest',
    ...(configId ? { config_id: configId, override_default_response_type: 'true' } : { scope: META_SCOPES.join(',') }),
  });
  return `${FB_DIALOG}?${q.toString()}`;
}

export async function facebookExchangeCode(input: { appId: string; appSecret: string; redirectUri: string; code: string }) {
  const q = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  return call<{ access_token: string; expires_in?: number }>(`${FB_GRAPH}/oauth/access_token?${q}`);
}

/** Short- or long-lived user token → long-lived user token (~60 days). */
export async function facebookLongLivedToken(app: { appId: string; appSecret: string }, token: string) {
  const q = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: app.appId,
    client_secret: app.appSecret,
    fb_exchange_token: token,
  });
  return call<{ access_token: string; expires_in?: number }>(`${FB_GRAPH}/oauth/access_token?${q}`);
}

export async function facebookMe(token: string) {
  const q = new URLSearchParams({ fields: 'id,name', access_token: token });
  return call<{ id: string; name: string }>(`${FB_GRAPH}/me?${q}`);
}

type PageRow = { id: string; name: string; access_token?: string; tasks?: string[]; instagram_business_account?: { id: string; username?: string } };
const PAGE_FIELDS = 'id,name,access_token,tasks,instagram_business_account{id,username}';

/**
 * The Pages the user may act on, with Page tokens and any linked Instagram
 * account. /me/accounts first; when it is empty the business-portfolio
 * routes are tried too (needs business_management): Pages assigned to the
 * person through a business, then the Pages its businesses own or manage.
 * Each extra route is best effort: a missing permission is not an error here.
 */
export async function facebookPages(token: string) {
  const q = (extra: Record<string, string> = {}) => new URLSearchParams({ fields: PAGE_FIELDS, limit: '100', access_token: token, ...extra });
  const seen = new Map<string, PageRow>();
  const add = (rows: PageRow[] | undefined) => {
    for (const p of rows ?? []) if (p?.id && p.access_token && !seen.has(p.id)) seen.set(p.id, p);
  };
  add((await call<{ data: PageRow[] }>(`${FB_GRAPH}/me/accounts?${q()}`)).data);
  if (seen.size === 0) {
    const tryGet = async <T,>(url: string): Promise<T | null> => {
      try {
        return await call<T>(url);
      } catch {
        return null;
      }
    };
    const assigned = await tryGet<{ data: PageRow[] }>(`${FB_GRAPH}/me/assigned_pages?${q()}`);
    add(assigned?.data);
    const bq = new URLSearchParams({
      fields: `id,name,owned_pages.limit(100){${PAGE_FIELDS}},client_pages.limit(100){${PAGE_FIELDS}}`,
      access_token: token,
    });
    const businesses = await tryGet<{ data: Array<{ owned_pages?: { data: PageRow[] }; client_pages?: { data: PageRow[] } }> }>(`${FB_GRAPH}/me/businesses?${bq}`);
    for (const b of businesses?.data ?? []) {
      add(b.owned_pages?.data);
      add(b.client_pages?.data);
    }
  }
  return [...seen.values()].map((p) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token!,
    tasks: p.tasks ?? [],
    instagramUserId: p.instagram_business_account?.id ?? null,
    instagramUsername: p.instagram_business_account?.username ?? null,
  }));
}

/**
 * One Page by id, asked for directly (2026-11-01). Facebook answers with a
 * Page token when the person has a role on it even when /me/accounts lists
 * nothing, which is what happened to the collective's own Page in
 * development mode. Null when the Page is unknown or the person has no role.
 */
export async function facebookPageById(token: string, pageId: string) {
  // No `tasks` here: a Page node has that field only on the /me/accounts edge
  // (verified 2026-11-01: "(#100) Tried accessing nonexisting field (tasks)").
  const q = new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: token });
  const p = await call<PageRow>(`${FB_GRAPH}/${encodeURIComponent(pageId)}?${q}`);
  if (!p?.id || !p.access_token) return null;
  return {
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    // A Page token means a role; Facebook enforces what the role may do on each post.
    tasks: ['CREATE_CONTENT'],
    instagramUserId: p.instagram_business_account?.id ?? null,
    instagramUsername: p.instagram_business_account?.username ?? null,
  };
}

/** Best effort: drop the app's permissions for this user. */
export async function facebookRevoke(token: string): Promise<void> {
  try {
    await fetch(`${FB_GRAPH}/me/permissions?access_token=${encodeURIComponent(token)}`, { method: 'DELETE' });
  } catch {
    /* the row is gone either way */
  }
}

// ── Threads ─────────────────────────────────────────────────────────────────

export function threadsAuthorizeUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    scope: THREADS_SCOPES.join(','),
    response_type: 'code',
    state: input.state,
  });
  return `${TH_AUTH}?${q.toString()}`;
}

export async function threadsExchangeCode(input: { appId: string; appSecret: string; redirectUri: string; code: string }) {
  return call<{ access_token: string; user_id: number | string }>(
    `${TH_GRAPH}/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: input.appId,
        client_secret: input.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
    },
    'Threads'
  );
}

export async function threadsLongLivedToken(appSecret: string, shortLived: string) {
  const q = new URLSearchParams({ grant_type: 'th_exchange_token', client_secret: appSecret, access_token: shortLived });
  return call<{ access_token: string; expires_in: number }>(`${TH_GRAPH}/access_token?${q}`, undefined, 'Threads');
}

export async function threadsRefreshToken(longLived: string) {
  const q = new URLSearchParams({ grant_type: 'th_refresh_token', access_token: longLived });
  return call<{ access_token: string; expires_in: number }>(`${TH_GRAPH}/refresh_access_token?${q}`, undefined, 'Threads');
}

export async function threadsMe(token: string) {
  const q = new URLSearchParams({ fields: 'id,username,name', access_token: token });
  return call<{ id: string; username: string; name?: string }>(`${TH_GRAPH}/v1.0/me?${q}`, undefined, 'Threads');
}

// ── Instagram (Instagram API with Instagram Login) ──────────────────────────
// A third app: the person signs in with Instagram directly, no Facebook Page
// needed. Professional (Business/Creator) accounts only.

const IG_AUTH = 'https://www.instagram.com/oauth/authorize';
const IG_API = 'https://api.instagram.com';
const IG_GRAPH = 'https://graph.instagram.com';
export const INSTAGRAM_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];

export function instagramApp(): { appId: string; appSecret: string } | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}

export function instagramAuthorizeUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    scope: INSTAGRAM_SCOPES.join(','),
    response_type: 'code',
    state: input.state,
  });
  return `${IG_AUTH}?${q.toString()}`;
}

export async function instagramExchangeCode(input: { appId: string; appSecret: string; redirectUri: string; code: string }) {
  return call<{ access_token: string; user_id: number | string }>(
    `${IG_API}/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: input.appId,
        client_secret: input.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
    },
    'Instagram'
  );
}

export async function instagramLongLivedToken(appSecret: string, shortLived: string) {
  const q = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: appSecret, access_token: shortLived });
  return call<{ access_token: string; expires_in: number }>(`${IG_GRAPH}/access_token?${q}`, undefined, 'Instagram');
}

export async function instagramRefreshToken(longLived: string) {
  const q = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: longLived });
  return call<{ access_token: string; expires_in: number }>(`${IG_GRAPH}/refresh_access_token?${q}`, undefined, 'Instagram');
}

export async function instagramMe(token: string) {
  const q = new URLSearchParams({ fields: 'user_id,username,name,account_type', access_token: token });
  return call<{ id?: string; user_id?: string; username: string; name?: string; account_type?: string }>(`${IG_GRAPH}/v21.0/me?${q}`, undefined, 'Instagram');
}
