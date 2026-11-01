import { db } from '@elkdonis/db';
import { sanitizeRichText } from '@elkdonis/utils';
import { getMeetingSeries, type MeetingSeries } from './meeting-series';
import { SERIES_KIND } from './thread-kinds';

/**
 * An organisation's public Series page (2026-10-18, IFAC first): the page
 * that introduces every series the org runs, and the order and featuring of
 * those series. Mockups: docs/open/series-index-mockups-2026-10-18/.
 *
 * Storage, no migration:
 *   - `site_config` key `series_page`: { eyebrow, heading, introHtml, order }
 *     (`order` = series thread ids, first shown first);
 *   - `site_config` key `presented_series`: { threadId }, the featured
 *     series, which also leads the landing page (existing key);
 *   - per series, `threads.metadata.series.accent` and `.listed`
 *     (`saveSeriesSettings`).
 * Only `kind = 'series'` rows are listed: legacy recurring `meeting` threads
 * (IFAC's "Weekly Meeting") are not series cards.
 */

const PAGE_KEY = 'series_page';
const PRESENTED_KEY = 'presented_series';

/**
 * Series colours: a mark colour for dots, row edges and calendar chips, and
 * a text colour for labels on the dark public page. Measured on #0b0b0d:
 * gold text #e3c572 11.7:1, teal #7fd6c8 11.4:1, rose #f2a7b8 10.1:1,
 * indigo #aab0ff 9.0:1, slate #c4c8d4 11.5:1. Marks are >= 3:1 on #0b0b0d.
 */
export const SERIES_ACCENTS: Array<{ id: string; label: string; mark: string; text: string }> = [
  { id: 'gold', label: 'Gold', mark: '#c9a24a', text: '#e3c572' },
  { id: 'teal', label: 'Teal', mark: '#3fb8a6', text: '#7fd6c8' },
  { id: 'rose', label: 'Rose', mark: '#c46b86', text: '#f2a7b8' },
  { id: 'indigo', label: 'Indigo', mark: '#7c82f0', text: '#aab0ff' },
  { id: 'slate', label: 'Slate', mark: '#8a8fa0', text: '#c4c8d4' },
];

export interface SeriesPageSettings {
  eyebrow: string;
  heading: string;
  /** Sanitised rich text; '' when none. */
  introHtml: string;
  /** Series thread ids in the order shown. Series not named follow, newest first. */
  order: string[];
  /** The featured series (`presented_series`); null when none is chosen. */
  featuredId: string | null;
}

/** Empty heading = the host page's own default (IFAC: "Series from IFAC"). */
export const SERIES_PAGE_DEFAULTS = { eyebrow: 'Series', heading: '' };

export async function getSeriesPageSettings(orgId: string): Promise<SeriesPageSettings> {
  const rows = await db<Array<{ key: string; value: Record<string, unknown> | null }>>`
    SELECT key, value FROM site_config WHERE org_id = ${orgId} AND key IN (${PAGE_KEY}, ${PRESENTED_KEY})
  `;
  const page = (rows.find((r) => r.key === PAGE_KEY)?.value ?? {}) as Record<string, unknown>;
  const presented = (rows.find((r) => r.key === PRESENTED_KEY)?.value ?? {}) as Record<string, unknown>;
  const str = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v.trim() : d);
  return {
    eyebrow: str(page.eyebrow, SERIES_PAGE_DEFAULTS.eyebrow),
    heading: typeof page.heading === 'string' ? page.heading.trim() : SERIES_PAGE_DEFAULTS.heading,
    introHtml: typeof page.introHtml === 'string' ? sanitizeRichText(page.introHtml) : '',
    order: Array.isArray(page.order) ? page.order.filter((x): x is string => typeof x === 'string').slice(0, 50) : [],
    featuredId: typeof presented.threadId === 'string' && presented.threadId ? presented.threadId : null,
  };
}

export interface SaveSeriesPageInput {
  orgId: string;
  eyebrow?: string;
  heading?: string;
  introHtml?: string;
  order?: string[];
  /** The featured series; null clears it. Must be a published series of this org. */
  featuredId?: string | null;
}

/** Write the Series page settings. The caller authorises (organisers only). */
export async function saveSeriesPageSettings(input: SaveSeriesPageInput): Promise<SeriesPageSettings> {
  const current = await getSeriesPageSettings(input.orgId);
  const own = new Set((await listSeriesRows(input.orgId)).map((r) => r.id));
  const clip = (v: string | undefined, max: number, d: string) => (v === undefined ? d : v.trim().slice(0, max));
  const next = {
    eyebrow: clip(input.eyebrow, 80, current.eyebrow),
    heading: clip(input.heading, 160, current.heading),
    introHtml: input.introHtml === undefined ? current.introHtml : sanitizeRichText(input.introHtml.slice(0, 20_000)),
    order: input.order === undefined ? current.order : input.order.filter((id) => own.has(id)).slice(0, 50),
  };
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${input.orgId}, ${PAGE_KEY}, ${db.json(next as never)}, NOW())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  if (input.featuredId !== undefined) {
    if (input.featuredId === null) {
      await db`DELETE FROM site_config WHERE org_id = ${input.orgId} AND key = ${PRESENTED_KEY}`;
    } else {
      if (!own.has(input.featuredId)) throw new Error('That series is not one of this organisation\'s series.');
      await db`
        INSERT INTO site_config (org_id, key, value, updated_at)
        VALUES (${input.orgId}, ${PRESENTED_KEY}, ${db.json({ threadId: input.featuredId } as never)}, NOW())
        ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
    }
  }
  return getSeriesPageSettings(input.orgId);
}

async function listSeriesRows(orgId: string): Promise<Array<{ id: string; created_at: Date }>> {
  return db<Array<{ id: string; created_at: Date }>>`
    SELECT id, created_at FROM threads
    WHERE org_id = ${orgId} AND kind = ${SERIES_KIND} AND status = 'published' AND recurrence_pattern IS NOT NULL
    ORDER BY created_at DESC
  `;
}

export interface SeriesPageEntry {
  series: MeetingSeries;
  accent: (typeof SERIES_ACCENTS)[number];
  listed: boolean;
  featured: boolean;
  /** Past its last date, or no week left to come. */
  ended: boolean;
  /** Before its first session. */
  upcoming: boolean;
  /** The card's rhythm line in the organiser's words; null = from the schedule. */
  rhythm: string | null;
  /** Show the status label on the card. */
  showStatus: boolean;
  /** In the landing page's slides (`metadata.series.landing`; absent = as listed). */
  inLanding: boolean;
}

/**
 * Every published series of the org, in page order: the featured one first,
 * then `order`, then the rest newest first; ended series last. Unlisted
 * series are included (flag `listed`) so the hub can show them.
 */
export async function listSeriesForPage(
  orgId: string,
  options: { count?: number; settings?: SeriesPageSettings } = {}
): Promise<SeriesPageEntry[]> {
  const settings = options.settings ?? (await getSeriesPageSettings(orgId));
  const rows = await listSeriesRows(orgId);
  const loaded = await Promise.all(
    rows.map((r) => getMeetingSeries(orgId, { threadId: r.id }, { count: options.count ?? 8 }).catch(() => null))
  );
  const now = Date.now();
  const entries: SeriesPageEntry[] = [];
  loaded.forEach((series, i) => {
    if (!series) return;
    const pres = series.presentation as { accent?: unknown; listed?: unknown; landing?: unknown; rhythm?: unknown; statusChip?: unknown };
    const until = series.recurrenceUntil ? Date.parse(series.recurrenceUntil) : NaN;
    const ended = (!Number.isNaN(until) && until < now) || !series.sessions.some((s) => !s.isPast);
    const first = series.scheduledAt ? Date.parse(series.scheduledAt) : NaN;
    entries.push({
      series,
      accent: SERIES_ACCENTS.find((a) => a.id === pres.accent) ?? SERIES_ACCENTS[i % SERIES_ACCENTS.length],
      listed: pres.listed !== false,
      featured: series.id === settings.featuredId,
      ended,
      upcoming: !ended && !Number.isNaN(first) && first > now,
      rhythm: typeof pres.rhythm === 'string' && pres.rhythm.trim() ? pres.rhythm.trim() : null,
      showStatus: pres.statusChip !== 'hide',
      inLanding: typeof pres.landing === 'boolean' ? pres.landing : pres.listed !== false,
    });
  });
  const rank = (e: SeriesPageEntry) => {
    const at = settings.order.indexOf(e.series.id);
    return [e.ended ? 1 : 0, e.featured ? 0 : 1, at === -1 ? 999 : at];
  };
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ra = rank(a.e);
      const rb = rank(b.e);
      for (let k = 0; k < ra.length; k++) if (ra[k] !== rb[k]) return ra[k] - rb[k];
      return a.i - b.i;
    })
    .map((x) => x.e);
}
