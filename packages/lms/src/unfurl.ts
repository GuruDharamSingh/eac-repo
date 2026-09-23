// ============================================================================
// Capture what a URL says about itself (OpenGraph / <title>), safely.
//
// This fetches an address an author typed, from inside our network — so it is
// an SSRF surface. Rules: http(s) only, default ports only, every hop's host is
// resolved and refused if ANY address is private/loopback/link-local, redirects
// are followed by hand (max 3) through the same check, 4 s budget, 512 KB cap,
// HTML only. A failure is never an error for the author: the link is still
// added, titled by its host.
// ============================================================================
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface Unfurled { url: string; title: string; description: string | null; imageUrl: string | null; siteName: string | null }

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only web links.');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Unusual port.');
  if (u.username || u.password) throw new Error('No credentials in links.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('That address isn’t on the public web.');
  return u;
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;|&#x27;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
function meta(html: string, keys: string[]): string | null {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content).slice(0, 500);
  }
  return null;
}

export async function unfurl(raw: string): Promise<Unfurled> {
  let url = raw.trim();
  const fallback = (): Unfurled => { let host = url; try { host = new URL(url).hostname; } catch { /* keep raw */ } return { url, title: host, description: null, imageUrl: null, siteName: host }; };
  try {
    for (let hop = 0; hop < 4; hop++) {
      const u = await assertPublicUrl(url);
      const res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(4000), headers: { 'user-agent': 'SophiaLinkPreview/1.0 (+https://sophia.arts-collective.com)', accept: 'text/html,application/xhtml+xml' } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location')!, u).toString(); continue; }
      if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? '')) return fallback();
      const reader = res.body?.getReader(); if (!reader) return fallback();
      const chunks: Uint8Array[] = []; let size = 0;
      while (size < 512 * 1024) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.byteLength; if (/<\/head>/i.test(new TextDecoder().decode(value))) break; }
      void reader.cancel().catch(() => {});
      const html = new TextDecoder().decode(Buffer.concat(chunks));
      const title = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)![1]) : null);
      const img = meta(html, ['og:image', 'twitter:image']);
      let imageUrl: string | null = null;
      if (img) { try { const iu = new URL(img, u); if (iu.protocol === 'https:') imageUrl = iu.toString(); } catch { /* ignore */ } }
      return { url: u.toString(), title: title || u.hostname, description: meta(html, ['og:description', 'description', 'twitter:description']), imageUrl, siteName: meta(html, ['og:site_name']) ?? u.hostname };
    }
  } catch { /* fall through */ }
  return fallback();
}
