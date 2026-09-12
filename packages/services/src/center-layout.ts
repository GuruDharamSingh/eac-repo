import { db } from '@elkdonis/db';

// ============================================================================
// The center's definition, as data.
//
// A network default (site_config under the `elkdonis` org, key
// `center_layout`) with a per-org override merged on top (the same key under
// the org), resolved here on the server the way themes resolve site default
// then page. An org therefore "defines its area" without a migration, and
// the network's influence is a row it can edit rather than code.
//
// Data, not DDL (migrations 073/091 set the precedent): the section ids are
// validated in app code against the curated list below; an unknown id is
// dropped, never a 500. Nothing here is per person — orgs customise, people
// don't (CENTER_PAGE_BRIEF, round three).
// ============================================================================

export const CENTER_SECTION_IDS = [
  // the person's column
  'profile',
  'buttons',
  'orgs',
  'promo',
  // the org's column
  'site',
  'org',
  'pinned',
  'feed',
  'featured',
  'network',
] as const;
export type CenterSectionId = (typeof CENTER_SECTION_IDS)[number];

export interface CenterLayout {
  /** Section order per column. A section absent from both columns is not shown. */
  columns: { left: CenterSectionId[]; right: CenterSectionId[] };
  /** Sections kept out of view even if listed — an org's veto. */
  hidden: CenterSectionId[];
  /** Per-section knobs the page understands. Unknown keys are carried, not used. */
  options: {
    feed?: { limit?: number };
    network?: { limit?: number };
    pinned?: { limit?: number };
    /** The scaled home-page view: '5:3' (default) or '4:3'. */
    site?: { ratio?: '5:3' | '4:3' };
  };
  /** The reading voice for the org's column; the surface system's own presets. */
  voice: 'journal' | 'gazette' | 'quiet';
}

export const DEFAULT_CENTER_LAYOUT: CenterLayout = {
  columns: {
    left: ['profile', 'buttons', 'orgs', 'promo'],
    right: ['site', 'org', 'pinned', 'feed', 'featured', 'network'],
  },
  hidden: [],
  options: { feed: { limit: 12 }, network: { limit: 12 }, pinned: { limit: 6 }, site: { ratio: '5:3' } },
  voice: 'journal',
};

/** The org whose site_config holds the network default. */
const NETWORK_CONFIG_ORG = 'elkdonis';

const isId = (v: unknown): v is CenterSectionId =>
  typeof v === 'string' && (CENTER_SECTION_IDS as readonly string[]).includes(v);

const clampLimit = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(50, Math.max(1, Math.round(v))) : fallback;

/** Take what a stored value has to say, and only what is valid, over `base`. */
function overlay(base: CenterLayout, raw: unknown): CenterLayout {
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const out: CenterLayout = {
    columns: { left: [...base.columns.left], right: [...base.columns.right] },
    hidden: [...base.hidden],
    options: { ...base.options },
    voice: base.voice,
  };

  const cols = r.columns as Record<string, unknown> | undefined;
  if (cols && typeof cols === 'object') {
    for (const side of ['left', 'right'] as const) {
      const list = cols[side];
      if (Array.isArray(list)) {
        const ids = list.filter(isId);
        // A column a store lists replaces the base's; de-duplicate, first wins.
        out.columns[side] = ids.filter((id, i) => ids.indexOf(id) === i);
      }
    }
    // A section may live in one column only: the most specific layer decides.
    out.columns.left = out.columns.left.filter((id) => !out.columns.right.includes(id) || !cols.right);
  }

  if (Array.isArray(r.hidden)) out.hidden = r.hidden.filter(isId);

  const opts = r.options as Record<string, unknown> | undefined;
  if (opts && typeof opts === 'object') {
    const o = { ...out.options };
    const feed = opts.feed as Record<string, unknown> | undefined;
    if (feed) o.feed = { limit: clampLimit(feed.limit, o.feed?.limit ?? 12) };
    const network = opts.network as Record<string, unknown> | undefined;
    if (network) o.network = { limit: clampLimit(network.limit, o.network?.limit ?? 12) };
    const pinned = opts.pinned as Record<string, unknown> | undefined;
    if (pinned) o.pinned = { limit: clampLimit(pinned.limit, o.pinned?.limit ?? 6) };
    const site = opts.site as Record<string, unknown> | undefined;
    if (site) o.site = { ratio: site.ratio === '4:3' ? '4:3' : site.ratio === '5:3' ? '5:3' : o.site?.ratio ?? '5:3' };
    out.options = o;
  }

  if (r.voice === 'journal' || r.voice === 'gazette' || r.voice === 'quiet') out.voice = r.voice;
  return out;
}

export interface ResolvedCenterLayout {
  layout: CenterLayout;
  /** Which layers contributed — for the console's "defined by" line. */
  sources: { network: boolean; org: boolean };
}

/**
 * Code default ← network default ← the org's own definition. Every step is
 * fail-soft: a bad row is ignored and the layer beneath it shows.
 */
export async function resolveCenterLayout(orgId: string): Promise<ResolvedCenterLayout> {
  let layout = DEFAULT_CENTER_LAYOUT;
  const sources = { network: false, org: false };
  try {
    const rows = await db<Array<{ org_id: string; value: unknown }>>`
      SELECT org_id, value FROM site_config
      WHERE key = 'center_layout' AND org_id IN (${NETWORK_CONFIG_ORG}, ${orgId})
    `;
    const network = rows.find((r) => r.org_id === NETWORK_CONFIG_ORG)?.value;
    const own = orgId !== NETWORK_CONFIG_ORG ? rows.find((r) => r.org_id === orgId)?.value : undefined;
    if (network) {
      layout = overlay(layout, network);
      sources.network = true;
    }
    if (own) {
      layout = overlay(layout, own);
      sources.org = true;
    }
  } catch (err) {
    console.error(`[center] resolveCenterLayout(${orgId}):`, err);
  }
  return { layout, sources };
}

/** Write an org's (or, for `elkdonis`, the network's) definition. Caller authorises. */
export async function saveCenterLayout(orgId: string, value: Partial<CenterLayout>): Promise<CenterLayout> {
  const cleaned = overlay(DEFAULT_CENTER_LAYOUT, value);
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${orgId}, 'center_layout', ${db.json(cleaned as any)}, NOW())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  return cleaned;
}
