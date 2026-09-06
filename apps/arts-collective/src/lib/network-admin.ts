import { db } from "@elkdonis/db";
import { networkHost } from "@/lib/domain";

/**
 * Read model for the network operations console (/hub/admin).
 *
 * Everything here is read-only and aggregate. The console exists to answer
 * "what exists, what is live, and what is half-wired" across the whole network
 * in one page — the questions you otherwise answer by opening psql.
 *
 * Queries are individually try/caught and degrade to empty rather than throwing.
 * A console that 500s because one new table hasn't been migrated yet is worse
 * than a console that renders with one empty panel.
 */

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  tier: string;
  subdomain_confirmed: boolean;
  layout_mode: string;
  silex_published: boolean;
  owner_email: string | null;
  member_count: number;
  published_count: number;
  draft_count: number;
  domains: string[];
  created_at: string;
};

export type DomainRow = {
  domain: string;
  org_id: string;
  org_slug: string | null;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

export type NetworkTotals = {
  orgs: number;
  users: number;
  admins: number;
  domains: number;
  orgsWithDomain: number;
};

/** A wiring problem worth showing on the console. */
export type HealthIssue = {
  key: string;
  label: string;
  detail: string;
  items: string[];
};

export async function getNetworkTotals(): Promise<NetworkTotals> {
  const empty: NetworkTotals = {
    orgs: 0,
    users: 0,
    admins: 0,
    domains: 0,
    orgsWithDomain: 0,
  };
  try {
    const [row] = await db<Array<NetworkTotals>>`
      SELECT
        (SELECT count(*) FROM organizations)::int AS orgs,
        (SELECT count(*) FROM users)::int AS users,
        (SELECT count(*) FROM users WHERE is_admin)::int AS admins,
        (SELECT count(*) FROM org_domains)::int AS domains,
        (SELECT count(DISTINCT org_id) FROM org_domains)::int AS "orgsWithDomain"
    `;
    return row ?? empty;
  } catch {
    // org_domains may not exist on a pre-081 database.
    try {
      const [row] = await db<Array<Omit<NetworkTotals, "domains" | "orgsWithDomain">>>`
        SELECT
          (SELECT count(*) FROM organizations)::int AS orgs,
          (SELECT count(*) FROM users)::int AS users,
          (SELECT count(*) FROM users WHERE is_admin)::int AS admins
      `;
      return { ...empty, ...(row ?? {}) };
    } catch {
      return empty;
    }
  }
}

export async function getOrgRows(): Promise<OrgRow[]> {
  try {
    return await db<OrgRow[]>`
      SELECT
        o.id,
        o.name,
        o.slug,
        o.tier,
        o.subdomain_confirmed,
        o.layout_mode,
        (o.silex_published_path IS NOT NULL) AS silex_published,
        (
          SELECT u.email
          FROM user_organizations uo
          JOIN users u ON u.id = uo.user_id
          WHERE uo.org_id = o.id AND uo.role = 'owner'
          ORDER BY u.email
          LIMIT 1
        ) AS owner_email,
        (SELECT count(*) FROM user_organizations uo WHERE uo.org_id = o.id)::int
          AS member_count,
        (SELECT count(*) FROM threads t
          WHERE t.org_id = o.id AND t.status = 'published')::int
          AS published_count,
        (SELECT count(*) FROM threads t
          WHERE t.org_id = o.id AND t.status <> 'published')::int
          AS draft_count,
        COALESCE(
          (SELECT array_agg(d.domain ORDER BY d.is_primary DESC, d.domain)
           FROM org_domains d WHERE d.org_id = o.id),
          '{}'
        ) AS domains,
        o.created_at
      FROM organizations o
      ORDER BY o.slug
    `;
  } catch {
    return [];
  }
}

export async function getDomainRows(): Promise<DomainRow[]> {
  try {
    return await db<DomainRow[]>`
      SELECT d.domain, d.org_id, o.slug AS org_slug,
             d.is_primary, d.verified_at, d.created_at
      FROM org_domains d
      LEFT JOIN organizations o ON o.id = d.org_id
      ORDER BY d.domain
    `;
  } catch {
    return [];
  }
}

/**
 * The "what isn't finished" panel.
 *
 * Derived from org rows already loaded rather than issuing more queries, so
 * adding a check here costs nothing. Each check is a thing that renders as a
 * broken or empty site for a real visitor.
 */
export function getHealthIssues(orgs: OrgRow[], domains: DomainRow[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const pending = orgs.filter((o) => !o.subdomain_confirmed);
  if (pending.length) {
    issues.push({
      key: "pending-review",
      label: "Awaiting intake interview",
      detail:
        "Created but not yet confirmed. The public sees a pending notice; the owner sees the real site. Confirm below once you have spoken.",
      items: pending.map((o) => o.slug),
    });
  }

  const noOwner = orgs.filter((o) => !o.owner_email);
  if (noOwner.length) {
    issues.push({
      key: "no-owner",
      label: "Organisations with no owner",
      detail:
        "Nobody can edit these sites. An owner row in user_organizations is what grants edit rights.",
      items: noOwner.map((o) => o.slug),
    });
  }

  const silexUnpublished = orgs.filter(
    (o) => o.layout_mode === "silex" && !o.silex_published
  );
  if (silexUnpublished.length) {
    issues.push({
      key: "silex-unpublished",
      label: "Silex layout, nothing published",
      detail:
        "layout_mode is 'silex' but silex_published_path is empty, so the site falls back to the default layout.",
      items: silexUnpublished.map((o) => o.slug),
    });
  }

  const noContent = orgs.filter((o) => o.published_count === 0);
  if (noContent.length) {
    issues.push({
      key: "no-content",
      label: "No published content",
      detail: "The site renders, but its feed is empty for visitors.",
      items: noContent.map(
        (o) => `${o.slug}${o.draft_count > 0 ? ` (${o.draft_count} draft)` : ""}`
      ),
    });
  }

  const noDomain = orgs.filter((o) => o.domains.length === 0);
  if (noDomain.length) {
    issues.push({
      key: "no-domain",
      label: "Subdomain only — no full domain mapped",
      detail: `Reachable at slug.${networkHost()}. Add a row to org_domains to serve a business's own domain.`,
      items: noDomain.map((o) => o.slug),
    });
  }

  const unverified = domains.filter((d) => !d.verified_at);
  if (unverified.length) {
    issues.push({
      key: "unverified-domain",
      label: "Domains without recorded verification",
      detail:
        "These serve normally — verification is recorded but not yet enforced at lookup. Treat as a to-do, not an outage.",
      items: unverified.map((d) => d.domain),
    });
  }

  const orphanDomain = domains.filter((d) => !d.org_slug);
  if (orphanDomain.length) {
    issues.push({
      key: "orphan-domain",
      label: "Domains pointing at a missing organisation",
      detail: "Should be impossible via the foreign key. If present, investigate.",
      items: orphanDomain.map((d) => d.domain),
    });
  }

  return issues;
}
