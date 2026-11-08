import "server-only";

// The shell as a hub card host (docs/open/hub-cards-handoff/PLAN.md §1.2,
// NETWORK_SERVING_ARCHITECTURE §4.2): on an org's own host, `/hub` is
// rewritten to /sites/<slug>/hub and draws the shared @elkdonis/hub cards for
// THAT org. `site` comes from the DB (organizations + org_domains), never from
// the request's query or body; `viewer` is the session person's role in it.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import { getPrimaryDomain } from "@elkdonis/services";
import type { HubRole, HubSite, HubViewer } from "@elkdonis/hub/contract";
import { networkHostWithPort } from "@/lib/domain";
import { getOrgBySlug } from "@/lib/org";
import { getOrgHomeUrl, networkUrl } from "@/lib/org-url";
import { getCurrentUser } from "@/lib/session";

const ROLES: ReadonlySet<string> = new Set<HubRole>(["owner", "guide", "member", "viewer"]);

export interface TenantHub {
  slug: string;
  site: HubSite;
  /** null = signed out. */
  viewer: HubViewer | null;
  /** The canonical network origin, for hops (Channel, Studio, consoles). */
  networkUrl: string;
}

function markOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [name.slice(0, 2)]).join("").toUpperCase();
}

/**
 * The org whose own host this request arrived on. The middleware sets
 * `x-org-slug` on tenant-host requests and strips any copy a client sent, so
 * this is the host's org and nothing else. Null on the canonical host.
 */
export async function tenantSlugFromRequest(): Promise<string | null> {
  return (await headers()).get("x-org-slug");
}

/**
 * The tenant hub draws only on the org's own host. Reached any other way
 * (arts-collective.com/sites/<slug>/hub typed on the network host) it sends
 * the person to the org's subdomain, which the shell always serves.
 */
export async function requireTenantHost(slug: string, path: string): Promise<void> {
  const arrived = await tenantSlugFromRequest();
  if (arrived && arrived.toLowerCase() === slug.toLowerCase()) return;
  const host = networkHostWithPort();
  const proto = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";
  redirect(`${proto}://${slug.toLowerCase()}.${host}${path}`);
}

async function viewerFor(orgId: string): Promise<HubViewer | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [row] = await db<Array<{ display_name: string | null; is_admin: boolean | null; role: string | null }>>`
    SELECT u.display_name, u.is_admin,
           (SELECT uo.role FROM user_organizations uo
             WHERE uo.user_id = u.id AND uo.org_id = ${orgId} LIMIT 1) AS role
    FROM users u WHERE u.id = ${user.id} LIMIT 1
  `;
  const role = row?.role && ROLES.has(row.role) ? (row.role as HubRole) : null;
  return {
    userId: user.id,
    name: row?.display_name || user.email,
    role,
    isNetworkAdmin: Boolean(row?.is_admin),
  };
}

export async function loadTenantHub(slug: string): Promise<TenantHub | null> {
  const org = await getOrgBySlug(slug);
  if (!org) return null;
  const [primaryDomain, viewer] = await Promise.all([getPrimaryDomain(org.id), viewerFor(org.id)]);
  const site: HubSite = {
    orgId: org.id,
    name: org.name,
    mark: markOf(org.name),
    domain: primaryDomain ?? `${org.slug}.${networkHostWithPort()}`,
    baseUrl: getOrgHomeUrl({ slug: org.slug, primaryDomain }),
    basePath: "",
    timeZone: process.env.SITE_TIME_ZONE ?? process.env.CHANNEL_TIME_ZONE ?? "America/Toronto",
    features: {},
  };
  return { slug: org.slug, site, viewer, networkUrl: networkUrl() };
}

/** The gate ifac's Members and Review mounts use: owners, guides, network admins. */
export function canManageHub(viewer: HubViewer | null): viewer is HubViewer {
  return Boolean(viewer && (viewer.role === "owner" || viewer.role === "guide" || viewer.isNetworkAdmin));
}
