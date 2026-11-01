import "server-only";
import { db } from "@elkdonis/db";
import { getPresentedSeriesId } from "@elkdonis/services";
import {
  copySlotsFor,
  getOrgEmailIdentity,
  listOrgTemplates,
  loadOrgTemplate,
  mergeFieldsFor,
  renderWithOrgOverrides,
  renderWithProps,
  resolveOrgTemplate,
  sampleProps,
  saveOrgTemplate,
  templateCandidates,
  templateMeta,
  type OrgTemplate,
  type OverridableProps,
} from "@elkdonis/email";
import type { EmailSuiteData, EmailTemplateSummary } from "@elkdonis/cms-ui/email";
import { siteConfig } from "@/config/site";
import {
  SERIES_LETTERS,
  parseSeriesLetter,
  seriesLettersHref,
  seriesScopeNote,
  type SeriesLetterScope,
} from "@/lib/series-letters";

// Per-series letters, server side: which threads are IFAC series, the series
// page's suite data, the scoped save, and the scoped preview. Queries live
// here and not in `lib/series-letters.ts`, which the client connectors import.

export interface IfacSeries {
  id: string;
  title: string;
}

/**
 * IFAC's series, by the rule the reminder tick uses (`lib/reminders.ts`
 * `seriesIds`): published, recurring, kind `series` / `meeting` / `event`,
 * and either kind `series`, `metadata.series` set, or the presented series.
 * `id` narrows to one thread; org `ifac` is always in the WHERE clause.
 */
async function querySeries(id?: string): Promise<IfacSeries[]> {
  const presented = await getPresentedSeriesId(siteConfig.orgId).catch(() => null);
  return db<IfacSeries[]>`
    SELECT id, title FROM threads
    WHERE org_id = ${siteConfig.orgId}
      AND status = 'published'
      AND kind IN ('series', 'meeting', 'event')
      AND recurrence_pattern IS NOT NULL
      AND (kind = 'series' OR metadata ? 'series' OR id = ${presented ?? ""})
      ${id ? db`AND id = ${id}` : db``}
    ORDER BY scheduled_at DESC NULLS LAST
  `;
}

/** One IFAC series, or null when the id is not one (another org's included). */
export async function findIfacSeries(id: string): Promise<IfacSeries | null> {
  const [row] = await querySeries(id);
  return row ?? null;
}

export async function listIfacSeries(): Promise<IfacSeries[]> {
  return querySeries();
}

/**
 * Scoped rows per series: keys `<templateKey>:<seriesId>` or
 * `<templateKey>:<seriesId>:<purpose>`. Counted from the rows the suite
 * already loaded, so `/manage/email` adds no query for it.
 */
export function countSeriesLetters(rows: Pick<OrgTemplate, "templateKey">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { templateKey } of rows) {
    const scope = templateKey.split(":")[1];
    if (scope) counts.set(scope, (counts.get(scope) ?? 0) + 1);
  }
  return counts;
}

/** The "Series" list of the `/manage/email` Letters tab. */
export async function loadSeriesList(
  rows: Pick<OrgTemplate, "templateKey">[]
): Promise<NonNullable<EmailSuiteData["series"]>> {
  const series = await listIfacSeries();
  const counts = countSeriesLetters(rows);
  return series.map((s) => ({
    id: s.id,
    title: s.title,
    href: seriesLettersHref(s.id),
    customised: counts.get(s.id) ?? 0,
  }));
}

/**
 * Read `?series=&purpose=` for one letter key.
 *
 * - no `series`: the organisation's letter (`{ kind: "org" }`);
 * - a valid pair for an IFAC series: its scope;
 * - anything else: an error with a status. A `purpose` without a `series`
 *   is an error rather than silently the org letter.
 */
export async function seriesScopeFrom(
  params: URLSearchParams,
  key: string
): Promise<
  | { kind: "org" }
  | { kind: "series"; scope: SeriesLetterScope; series: IfacSeries }
  | { kind: "error"; status: number; error: string }
> {
  const seriesId = params.get("series");
  const purpose = params.get("purpose");
  if (!seriesId) {
    return purpose ? { kind: "error", status: 400, error: "A purpose needs a series" } : { kind: "org" };
  }
  const parsed = parseSeriesLetter(key, seriesId, purpose);
  if ("error" in parsed) return { kind: "error", status: parsed.status, error: parsed.error };
  const series = await findIfacSeries(parsed.scope.seriesId);
  if (!series) return { kind: "error", status: 404, error: "No such series" };
  return { kind: "series", scope: parsed.scope, series };
}

type SaveInput = Parameters<typeof saveOrgTemplate>[2];

/**
 * Save one series letter to its scoped key.
 *
 * The send path resolves ONE row (`resolveOrgTemplate`), not a merge of the
 * chain, so a scoped row holding only the block somebody changed would drop
 * every other word IFAC's letter has. On the first save the scoped row is
 * therefore seeded with the words of the row it replaces (the series-wide
 * row, else IFAC's): body, copy blocks, links and media. A layout (`html` /
 * `project`) is not copied: series letters are edited as words.
 */
export async function saveSeriesLetter(
  scope: SeriesLetterScope,
  input: SaveInput,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const orgId = siteConfig.orgId;
  const existing = await loadOrgTemplate(orgId, scope.scopedKey);
  let toSave: SaveInput = input;
  if (!existing) {
    const base = await resolveOrgTemplate(orgId, scope.key, scope.fallbackScopes);
    if (base) {
      toSave = {
        ...input,
        bodyText: "bodyText" in input ? input.bodyText : base.bodyText,
        bodyHtml: "bodyHtml" in input ? input.bodyHtml : base.bodyHtml,
        // A slot set to null in `input` stays null, and the store drops it.
        copy:
          input.copy === null
            ? null
            : ({ ...(base.copy ?? {}), ...(input.copy ?? {}) } as SaveInput["copy"]),
        links: "links" in input ? input.links : base.links,
        media: "media" in input ? input.media : base.media,
      };
    }
  }
  return saveOrgTemplate(orgId, scope.scopedKey, toSave, userId);
}

/**
 * One series letter rendered as its sender would render it, with sample
 * props: identity, the scope chain, scoped precedence and a layout if one is
 * stored. Reads only.
 */
export async function renderSeriesLetter(scope: SeriesLetterScope): Promise<string> {
  const identity = await getOrgEmailIdentity(siteConfig.orgId);
  const data = {
    ...sampleProps(scope.key, { orgName: identity.fromName, purpose: scope.purpose }),
    orgId: siteConfig.orgId,
    templateScope: scope.scopes,
  } as OverridableProps;
  return renderWithOrgOverrides(
    scope.key,
    data,
    (d) => renderWithProps(scope.key, d as Record<string, unknown>),
    { previewText: scope.letter.title, kicker: scope.letter.title }
  );
}

/** First of `candidates` present in `byKey`. */
function firstRow(byKey: Map<string, OrgTemplate>, candidates: string[]): OrgTemplate | undefined {
  for (const key of candidates) {
    const row = byKey.get(key);
    if (row) return row;
  }
  return undefined;
}

/**
 * The suite data for `/manage/email/series/[id]`: Letters only, one entry per
 * `SERIES_LETTERS` row, keyed by the letter id (`reminder:subscriber`), which
 * the series connectors turn back into `?series=&purpose=`.
 *
 * Each editable letter opens on the series' own words when it has a row, and
 * otherwise on the words it inherits (IFAC's), which is what the first save
 * stores (see `saveSeriesLetter`).
 */
export async function loadSeriesLetters(series: IfacSeries): Promise<EmailSuiteData> {
  const orgId = siteConfig.orgId;
  const [identity, rows] = await Promise.all([
    getOrgEmailIdentity(orgId),
    listOrgTemplates(orgId),
  ]);
  const byKey = new Map(rows.map((r) => [r.templateKey, r]));

  const templates: EmailTemplateSummary[] = SERIES_LETTERS.map((letter) => {
    const meta = templateMeta(letter.key);
    const head = {
      key: letter.id,
      title: letter.title,
      trigger: letter.trigger,
      recipient: letter.recipient,
      editHint: meta?.editHint,
    };

    if (!letter.editable) {
      return {
        ...head,
        editable: false,
        override: "default" as const,
        stateLabel: "Not customisable per series",
        lockedNote:
          "This notice goes to whoever runs IFAC, so a series has no version of its own. It uses the IFAC letter.",
        slots: [],
        mergeFields: [],
      };
    }

    const parsed = parseSeriesLetter(letter.key, series.id, letter.purpose);
    if ("error" in parsed) throw new Error(`series letter ${letter.id}: ${parsed.error}`);
    const { scope } = parsed;
    const own = byKey.get(scope.scopedKey);
    const words = own ?? firstRow(byKey, templateCandidates(scope.key, scope.fallbackScopes));

    return {
      ...head,
      editable: true,
      bodyText: words?.bodyText ?? null,
      bodyHtml: words?.bodyHtml ?? null,
      slots: copySlotsFor(scope.key).map((slot) => ({
        id: slot.id,
        label: slot.label,
        hint: slot.hint,
        kind: slot.kind,
        fallback: slot.value.join("\n\n"),
        text: words?.copy?.[slot.id]?.text ?? null,
        html: words?.copy?.[slot.id]?.html ?? null,
        tokens: slot.tokens,
      })),
      mergeFields: mergeFieldsFor(scope.key).map((f) => ({ name: f.name, label: f.label })),
      override: own ? (own.html ? ("layout" as const) : ("words" as const)) : ("default" as const),
      stateLabel: own ? "Customised for this series" : "Uses the IFAC letter",
      scopeNote: seriesScopeNote(letter.title, series.title),
      resetLabel: own ? "Back to the IFAC letter" : undefined,
    };
  });

  return {
    orgId,
    orgName: identity.fromName,
    identity: {
      fromEmail: identity.fromEmail,
      fromName: identity.fromName,
      replyTo: identity.replyTo ?? null,
      ownerEmails: identity.ownerEmails,
      fromIsOrgDomain: identity.fromIsOrgDomain,
      palette: identity.palette,
      inboundReplies: identity.inboundReplies,
      inboundAddress: null,
    },
    // Letters only: the other tabs are the organisation's and live on
    // /manage/email.
    activity: [],
    inbox: [],
    unread: 0,
    addresses: [],
    stats: { sent: 0, delivered: 0, bounced: 0, unsubscribed: 0, pending: 0 },
    templates,
    suiteHref: "/manage/email?tab=letters",
  };
}
