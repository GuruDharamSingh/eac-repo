/**
 * Threads API (2026-10-29). A separate Meta app with its own id/secret and its
 * own host, graph.threads.net. Tokens: a short-lived token from the code
 * exchange (1 hour), a long-lived one from th_exchange_token (60 days),
 * refreshed with th_refresh_token while it is still valid and older than 24h.
 * https://developers.facebook.com/docs/threads
 */

export const THREADS_AUTH = 'https://threads.net/oauth/authorize';
export const THREADS_GRAPH = 'https://graph.threads.net';
export const THREADS_API = `${THREADS_GRAPH}/v1.0`;
export const THREADS_SCOPES = ['threads_basic', 'threads_content_publish'];

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; type?: string; code?: number } };
  if (!res.ok || (data as any)?.error) {
    const e = (data as any)?.error;
    throw new Error(`Threads said: ${e?.message ?? res.status}${e?.code ? ` (code ${e.code})` : ''}`);
  }
  return data;
}

export function threadsAuthorizeUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    scope: THREADS_SCOPES.join(','),
    response_type: 'code',
    state: input.state,
  });
  return `${THREADS_AUTH}?${q.toString()}`;
}

/** Code → short-lived token and the Threads user id. */
export async function threadsExchangeCode(input: { appId: string; appSecret: string; redirectUri: string; code: string }) {
  return call<{ access_token: string; user_id: number | string }>(`${THREADS_GRAPH}/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.appId,
      client_secret: input.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      code: input.code,
    }),
  });
}

export async function threadsLongLivedToken(appSecret: string, shortLived: string) {
  const q = new URLSearchParams({ grant_type: 'th_exchange_token', client_secret: appSecret, access_token: shortLived });
  return call<{ access_token: string; token_type: string; expires_in: number }>(`${THREADS_GRAPH}/access_token?${q}`);
}

export async function threadsRefreshToken(longLived: string) {
  const q = new URLSearchParams({ grant_type: 'th_refresh_token', access_token: longLived });
  return call<{ access_token: string; token_type: string; expires_in: number }>(`${THREADS_GRAPH}/refresh_access_token?${q}`);
}

export async function threadsMe(accessToken: string) {
  const q = new URLSearchParams({ fields: 'id,username,name,threads_profile_picture_url', access_token: accessToken });
  return call<{ id: string; username: string; name?: string; threads_profile_picture_url?: string }>(`${THREADS_API}/me?${q}`);
}

export interface ThreadsPostResult {
  mediaId: string;
  url: string;
}

/**
 * Publish a text post, optionally with one image (a public JPEG/PNG URL
 * Meta's servers can fetch). Two steps: a container, then publish. Threads
 * recommends waiting for the container; text containers are ready at once,
 * image ones usually within seconds.
 */
export async function postToThreads(
  userId: string,
  accessToken: string,
  input: { text: string; imageUrl?: string; linkAttachment?: string }
): Promise<ThreadsPostResult> {
  const params: Record<string, string> = { access_token: accessToken, text: input.text.slice(0, 500) };
  if (input.imageUrl) {
    params.media_type = 'IMAGE';
    params.image_url = input.imageUrl;
  } else {
    params.media_type = 'TEXT';
    if (input.linkAttachment) params.link_attachment = input.linkAttachment;
  }
  const container = await call<{ id: string }>(`${THREADS_API}/${userId}/threads`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  if (input.imageUrl) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const q = new URLSearchParams({ fields: 'status,error_message', access_token: accessToken });
      const s = await call<{ status: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED'; error_message?: string }>(
        `${THREADS_API}/${container.id}?${q}`
      );
      if (s.status === 'FINISHED') break;
      if (s.status === 'ERROR' || s.status === 'EXPIRED') throw new Error(`Threads could not ingest the image: ${s.error_message ?? s.status}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const published = await call<{ id: string }>(`${THREADS_API}/${userId}/threads_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: container.id, access_token: accessToken }),
  });
  let url = '';
  try {
    const q = new URLSearchParams({ fields: 'permalink', access_token: accessToken });
    url = (await call<{ permalink?: string }>(`${THREADS_API}/${published.id}?${q}`)).permalink ?? '';
  } catch {
    /* permalink is a convenience */
  }
  return { mediaId: published.id, url };
}
