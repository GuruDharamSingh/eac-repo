import { notFound, redirect } from "next/navigation";
import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/hub/industry.css";
import { membersServer } from "@elkdonis/hub/server/members";
import { loadReviewQueue } from "@elkdonis/hub/server/review";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";
import { TenantMembersCard, TenantReviewCard, type TenantHubLinks } from "@/components/sites/hub/TenantHubCards";
import { canManageHub, loadTenantHub, requireTenantHost } from "@/lib/tenant-hub";

export const metadata = { title: "Hub" };
export const dynamic = "force-dynamic";

/**
 * An org's own hub on its own host: `<org>.arts-collective.com/hub` (and a
 * shell-served custom domain's /hub), rewritten here by the middleware
 * (lib/tenant-paths.ts). Until 2026-11-08 that address drew the NETWORK hub.
 *
 * Draws the shared @elkdonis/hub cards for this org only, with ifac's gates:
 * Members and Review for owners, guides and network admins, gated in this page
 * and again in each card loader. Site Builder needs a shell declaration and
 * save adapter (Lane B), so until then its tile opens the network page
 * designer by hop, as Channel and Studio do (D-3).
 */
export default async function TenantHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireTenantHost(slug, "/hub");
  const hub = await loadTenantHub(slug);
  if (!hub) notFound();
  const { site, viewer, networkUrl } = hub;
  if (!viewer) redirect("/login?next=/hub");

  const manager = canManageHub(viewer);
  const [members, review] = manager
    ? await Promise.all([
        membersServer.load(site, viewer).catch((err) => {
          console.error(`[tenant-hub] members ${site.orgId}:`, err);
          return null;
        }),
        loadReviewQueue(site, viewer).catch((err) => {
          console.error(`[tenant-hub] review ${site.orgId}:`, err);
          return null;
        }),
      ])
    : [null, null];

  const links: TenantHubLinks = { networkUrl, orgId: site.orgId, orgSlug: hub.slug };
  const org = encodeURIComponent(hub.slug);
  const hops = manager
    ? [
        { href: `${networkUrl}/hub/sites/${org}/design`, label: "Site Builder", note: "Design this site’s pages" },
        { href: `${networkUrl}/channel?org=${org}`, label: "Channel", note: "What goes out, and when" },
        { href: `${networkUrl}/studio?org=${org}`, label: "Studio", note: "Write and publish" },
        { href: `${networkUrl}/hub/organization?org=${org}`, label: "Organization console", note: "On Arts Collective" },
      ]
    : [
        { href: "/center", label: "Center", note: `Your place in ${site.name}` },
        { href: "/account", label: "Your account", note: "Profile and sign-in" },
        { href: `${networkUrl}/hub/network`, label: "The network hub", note: "On Arts Collective" },
      ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav orgName={site.name} current="hub" signedIn />
      <main className="mx-auto max-w-5xl px-6 py-10" data-page="tenant-hub">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Hub</p>
          <h1 className="mt-2 font-serif text-3xl">{site.name}</h1>
          {!viewer.role && !viewer.isNetworkAdmin ? (
            <p className="mt-3 text-sm text-muted-foreground">
              This hub is for the people who run {site.name}. You are signed in, but not as one of its members.
            </p>
          ) : null}
        </header>

        {manager && (members || review) ? (
          <section className="mb-10 grid gap-6 md:grid-cols-2" aria-label="Cards">
            {members ? <TenantMembersCard data={members} links={links} /> : null}
            {review ? <TenantReviewCard data={review} links={links} /> : null}
          </section>
        ) : null}

        <section aria-label="More">
          <ul className="grid gap-3 sm:grid-cols-2">
            {hops.map((h) => (
              <li key={h.label}>
                <a
                  href={h.href}
                  className="block rounded-md border border-border bg-card px-4 py-3 hover:bg-accent"
                >
                  <span className="font-medium">{h.label}</span>
                  <span className="block text-sm text-muted-foreground">{h.note}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter orgName={site.name} />
    </div>
  );
}
