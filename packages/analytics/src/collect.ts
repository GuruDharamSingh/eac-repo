import { createHash, createHmac, randomUUID } from 'node:crypto';
import { db } from '@elkdonis/db';
import { SESSION_GAP_MINUTES, type CollectPayload } from './index';
import { classifySource, parseUserAgent } from './classify';
import { lookupGeo } from './geo';

// ---------------------------------------------------------------------------
// Collector core: turns one beacon payload plus request facts into rows.
// Kept free of Next types so scripts/check-collector.mts can drive it.
// ---------------------------------------------------------------------------

export interface CollectOptions {
  /** Org that owns pages on hosts with no org_domains row and no subdomain. */
  defaultOrgId?: string | null;
  /**
   * Single-tenant apps: every page on this app belongs to this org, whatever the
   * host maps to (fourthwayBookreaders shares elkdonis-arts.org with innergathering).
   */
  forceOrgId?: string | null;
  /** Hosts under this domain are the network; `<slug>.<domain>` is an org site. */
  networkDomain?: string;
  /** Orgs whose pages are aggregate-only unless the page is a public thread. */
  privateOrgIds?: string[];
  /** Path prefixes never recorded (management and sign-in screens). */
  ignorePrefixes?: string[];
}

export interface CollectRequest {
  payload: CollectPayload;
  host: string;
  ip: string | null;
  userAgent: string;
  /** users.id of the signed-in visitor, if any. */
  userId: string | null;
}

const DEFAULT_IGNORE = ['/api', '/_next', '/login', '/signup', '/auth', '/logout', '/manage', '/admin', '/hub/admin', '/hub/analytics', '/studio'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveOptions(o: CollectOptions = {}): Required<CollectOptions> {
  const envPrivate = (process.env.ANALYTICS_PRIVATE_ORGS ?? 'inner_group').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    defaultOrgId: o.defaultOrgId ?? null,
    forceOrgId: o.forceOrgId ?? null,
    networkDomain: o.networkDomain ?? process.env.ANALYTICS_NETWORK_DOMAIN ?? 'arts-collective.com',
    privateOrgIds: o.privateOrgIds ?? envPrivate,
    ignorePrefixes: [...DEFAULT_IGNORE, ...(o.ignorePrefixes ?? [])],
  };
}

// --- visitor hash ----------------------------------------------------------

function secret(): string | null {
  return process.env.ANALYTICS_SECRET || process.env.INTER_APP_JWT_SECRET || null;
}

/**
 * Anonymous visitor id: HMAC of (day, ip, user agent, host) under a key derived
 * from a server secret and the UTC day. The key changes daily, so ids cannot be
 * joined across days, and without the secret they cannot be reversed to an IP.
 */
export function visitorId(ip: string | null, ua: string, host: string, now = new Date()): string | null {
  const s = secret();
  if (!s) return null;
  const day = now.toISOString().slice(0, 10);
  const dayKey = createHmac('sha256', s).update(`analytics:${day}`).digest();
  return createHash('sha256').update(dayKey).update(`${ip ?? ''}|${ua}|${host}`).digest('hex').slice(0, 32);
}

// --- org and network lookups (cached) --------------------------------------

const hostOrgCache = new Map<string, { orgId: string | null; at: number }>();
let networkHostsCache: { hosts: Set<string>; at: number } | null = null;
const CACHE_MS = 5 * 60_000;

async function siteOrg(host: string, opts: Required<CollectOptions>): Promise<string | null> {
  if (opts.forceOrgId) return opts.forceOrgId;
  const hit = hostOrgCache.get(host);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.orgId;

  const bare = host.replace(/^www\./, '');
  let orgId: string | null = null;
  const [byDomain] = await db<Array<{ org_id: string }>>`
    SELECT org_id FROM org_domains WHERE domain IN (${host}, ${bare}) LIMIT 1
  `;
  if (byDomain) orgId = byDomain.org_id;
  else if (host.endsWith(`.${opts.networkDomain}`)) {
    const slug = host.slice(0, -(opts.networkDomain.length + 1)).split('.').pop() ?? '';
    const [bySlug] = await db<Array<{ id: string }>>`SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1`;
    orgId = bySlug?.id ?? opts.defaultOrgId;
  } else orgId = opts.defaultOrgId;

  hostOrgCache.set(host, { orgId, at: Date.now() });
  return orgId;
}

async function networkHosts(): Promise<Set<string>> {
  if (networkHostsCache && Date.now() - networkHostsCache.at < CACHE_MS) return networkHostsCache.hosts;
  const rows = await db<Array<{ domain: string }>>`SELECT domain FROM org_domains`;
  const hosts = new Set(rows.map((r) => r.domain.replace(/^www\./, '')));
  networkHostsCache = { hosts, at: Date.now() };
  return hosts;
}

// --- helpers ---------------------------------------------------------------

function cleanPath(raw: string): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null;
  const p = raw.split(/[?#]/)[0].slice(0, 512);
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

function utm(search: string | undefined): { source: string | null; medium: string | null; campaign: string | null } {
  try {
    const q = new URLSearchParams(search ?? '');
    const g = (k: string) => (q.get(k) ?? '').trim().slice(0, 100) || null;
    return { source: g('utm_source'), medium: g('utm_medium'), campaign: g('utm_campaign') };
  } catch {
    return { source: null, medium: null, campaign: null };
  }
}

function cleanProps(props: CollectPayload['props']): Record<string, string | number | boolean | null> | null {
  if (!props || typeof props !== 'object') return null;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props).slice(0, 10)) {
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      out[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 200) : v;
    }
  }
  return Object.keys(out).length ? out : null;
}

export type CollectResult = 'recorded' | 'ignored';

// --- main ------------------------------------------------------------------

export async function recordCollect(req: CollectRequest, options?: CollectOptions): Promise<CollectResult> {
  const opts = resolveOptions(options);
  const { payload, host, ip, userId } = req;

  const ua = parseUserAgent(req.userAgent);
  if (ua.bot) return 'ignored';
  const visitor = visitorId(ip, req.userAgent, host);
  if (!visitor) return 'ignored';

  const id = UUID.test(payload.id ?? '') ? payload.id : randomUUID();

  if (payload.type === 'leave') {
    const ms = Math.round(Number(payload.duration));
    if (!Number.isFinite(ms) || ms < 0) return 'ignored';
    await db`
      UPDATE analytics_events
      SET duration_ms = GREATEST(COALESCE(duration_ms, 0), ${Math.min(ms, 30 * 60_000)})
      WHERE id = ${id} AND visitor_id = ${visitor} AND occurred_at > NOW() - INTERVAL '1 day'
    `;
    return 'recorded';
  }

  if (payload.type !== 'pageview' && payload.type !== 'event') return 'ignored';
  const path = cleanPath(payload.path);
  if (!path) return 'ignored';
  if (opts.ignorePrefixes.some((p) => path === p || path.startsWith(`${p}/`))) return 'ignored';
  if (payload.type === 'event' && !(typeof payload.name === 'string' && /^[\w .:-]{1,60}$/.test(payload.name))) return 'ignored';

  const siteOrgId = await siteOrg(host, opts);

  // A post's views belong to the post's org (a visit to the network front page
  // that opens another org's thread counts for that org); everything else to
  // the org that owns the host.
  let orgId = siteOrgId;
  let threadId: string | null = null;
  let isPrivate = false;
  if (typeof payload.thread === 'string' && payload.thread.length > 0 && payload.thread.length <= 21) {
    const [t] = await db<Array<{ id: string; org_id: string; visibility: string; status: string }>>`
      SELECT id, org_id, visibility, status FROM threads WHERE id = ${payload.thread}
    `;
    if (t) {
      orgId = t.org_id;
      if (t.visibility === 'PUBLIC' && t.status === 'published') threadId = t.id;
      else isPrivate = true;
    }
  }
  if (!threadId && !isPrivate && orgId && opts.privateOrgIds.includes(orgId)) isPrivate = true;

  const now = new Date();
  const q = utm(payload.search);
  const source = classifySource(payload.referrer, host, { medium: q.medium }, await networkHosts(), opts.networkDomain);
  const geo = await lookupGeo(ip);

  // Session: continue the visitor's open visit, else this page view starts one.
  let sessionId = id;
  let isEntry = true;
  const [open] = await db<Array<{ session_id: string }>>`
    SELECT session_id FROM analytics_events
    WHERE visitor_id = ${visitor}
      AND occurred_at > NOW() - (${SESSION_GAP_MINUTES} * INTERVAL '1 minute')
    ORDER BY occurred_at DESC LIMIT 1
  `;
  if (open) {
    sessionId = open.session_id;
    isEntry = false;
  }

  const kind = payload.type;
  await db`
    INSERT INTO analytics_events (
      id, occurred_at, org_id, host, kind, name, props, path, thread_id, is_private,
      visitor_id, session_id, is_entry, user_id, source_kind, referrer_host,
      utm_source, utm_medium, utm_campaign, country, region, device, browser, os
    ) VALUES (
      ${id}, ${now}, ${orgId}, ${host}, ${kind}, ${kind === 'event' ? payload.name! : null},
      ${kind === 'event' && cleanProps(payload.props) ? db.json(cleanProps(payload.props)!) : null},
      ${isPrivate ? null : path}, ${threadId}, ${isPrivate},
      ${visitor}, ${sessionId}, ${isEntry && kind === 'pageview'}, ${userId},
      ${kind === 'pageview' ? source.kind : null}, ${isPrivate ? null : source.referrerHost},
      ${isPrivate ? null : q.source}, ${isPrivate ? null : q.medium}, ${isPrivate ? null : q.campaign},
      ${geo.country}, ${geo.region}, ${ua.device}, ${ua.browser}, ${ua.os}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  if (userId && kind === 'pageview') {
    await db`UPDATE users SET last_seen_at = NOW() WHERE id = ${userId} AND last_seen_at < NOW() - INTERVAL '10 minutes'`;
    if (siteOrgId) {
      await db`
        INSERT INTO user_site_visits (user_id, org_id, visit_count, page_count)
        VALUES (${userId}, ${siteOrgId}, ${isEntry ? 1 : 0}, 1)
        ON CONFLICT (user_id, org_id) DO UPDATE
        SET last_seen_at = NOW(),
            page_count = user_site_visits.page_count + 1,
            visit_count = user_site_visits.visit_count + ${isEntry ? 1 : 0}
      `;
    }
  }
  return 'recorded';
}
