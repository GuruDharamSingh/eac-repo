/**
 * Publishing through the "Instagram API with Instagram Login" (2026-10-29):
 * graph.instagram.com with a token from that app, no Facebook Page involved.
 * Same two-step container/publish as the Page-linked route in instagram.ts.
 */

const IG_API = 'https://graph.instagram.com/v21.0';

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || data?.error) {
    const e = data?.error;
    throw new Error(`Instagram said: ${e?.message ?? res.status}${e?.code ? ` (code ${e.code})` : ''}`);
  }
  return data as T;
}

export async function postImageWithInstagramLogin(
  igUserId: string,
  accessToken: string,
  input: { imageUrl: string; caption?: string }
): Promise<{ mediaId: string; url: string }> {
  const container = await call<{ id: string }>(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image_url: input.imageUrl, caption: input.caption ?? '', access_token: accessToken }),
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const q = new URLSearchParams({ fields: 'status_code,status', access_token: accessToken });
    const s = await call<{ status_code: string; status?: string }>(`${IG_API}/${container.id}?${q}`);
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') {
      throw new Error(`Instagram could not ingest the image (${s.status_code}): ${s.status ?? 'no detail'}. It must be a public JPEG.`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const published = await call<{ id: string }>(`${IG_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: container.id, access_token: accessToken }),
  });
  let url = '';
  try {
    const q = new URLSearchParams({ fields: 'permalink', access_token: accessToken });
    url = (await call<{ permalink?: string }>(`${IG_API}/${published.id}?${q}`)).permalink ?? '';
  } catch {
    /* convenience only */
  }
  return { mediaId: published.id, url };
}
