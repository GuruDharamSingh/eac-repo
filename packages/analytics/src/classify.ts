import type { SourceKind } from './index';

// ---------------------------------------------------------------------------
// User agent → device / browser / OS, and referrer → source. Deliberately
// small: an unrecognised agent is reported as "Other", never guessed.
// ---------------------------------------------------------------------------

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|curl\/|wget|python-requests|python-urllib|go-http-client|java\/|okhttp|headless|lighthouse|pingdom|uptime|scrapy|httpclient|axios|node-fetch|undici|phantomjs|puppeteer|playwright|selenium|gptbot|claude-web|perplexity|bytespider|ahrefs|semrush|mj12/i;

export interface ParsedUa {
  bot: boolean;
  device: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
}

export function parseUserAgent(ua: string): ParsedUa {
  if (!ua || BOT_UA.test(ua)) return { bot: true, device: 'desktop', browser: 'Other', os: 'Other' };

  const tablet = /ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua);
  const mobile = !tablet && /mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua);

  let browser = 'Other';
  if (/edg(e|a|ios)?\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/chrome|crios|chromium/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = 'Other';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux|x11/i.test(ua)) os = 'Linux';

  return { bot: false, device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop', browser, os };
}

const SEARCH = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|baidu|yandex|startpage|qwant|kagi|search\.brave|brave|ask|aol)\.[a-z.]+$/i;
const SOCIAL =
  /(^|\.)(facebook|instagram|fb|t|twitter|x|linkedin|lnkd|reddit|youtube|youtu|pinterest|tiktok|threads|bsky|mastodon|tumblr|substack|medium|whatsapp|telegram|discord|patreon)\.[a-z.]+$/i;
const MAIL = /(^|\.)(mail\.google|outlook\.live|outlook\.office|mail\.yahoo|proton|mail)\.[a-z.]+$/i;

export interface Source {
  kind: SourceKind;
  referrerHost: string | null;
}

/**
 * Where a visit came from. `utm_medium` wins over the referrer; a referrer on
 * the visitor's own host is not a source (the caller drops it first); a host in
 * `networkHosts` or under `networkDomain` is the network.
 */
export function classifySource(
  referrer: string | undefined,
  host: string,
  utm: { medium?: string | null },
  networkHosts: ReadonlySet<string>,
  networkDomain: string
): Source {
  let refHost: string | null = null;
  try {
    refHost = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') : null;
  } catch {
    refHost = null;
  }
  const self = host.replace(/^www\./, '');
  if (refHost === self) refHost = null; // internal navigation

  const medium = (utm.medium ?? '').toLowerCase();
  if (medium === 'email' || medium === 'newsletter') return { kind: 'email', referrerHost: refHost };
  if (medium === 'social' || medium === 'social-media') return { kind: 'social', referrerHost: refHost };
  if (['cpc', 'ppc', 'paid', 'search'].includes(medium)) return { kind: 'search', referrerHost: refHost };

  if (!refHost) return { kind: 'direct', referrerHost: null };
  if (refHost === networkDomain || refHost.endsWith(`.${networkDomain}`) || networkHosts.has(refHost)) {
    return { kind: 'network', referrerHost: refHost };
  }
  if (SEARCH.test(refHost)) return { kind: 'search', referrerHost: refHost };
  if (MAIL.test(refHost)) return { kind: 'email', referrerHost: refHost };
  if (SOCIAL.test(refHost)) return { kind: 'social', referrerHost: refHost };
  return { kind: 'referral', referrerHost: refHost };
}
