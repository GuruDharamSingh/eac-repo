import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  getOrgFollowerCount,
  getOrgIdentity,
  isEnrolledInWorkshop,
  isFollowingOrg,
  listOrgMembers,
} from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getCurrentUser } from "@/lib/session";
import { getOfferingThread, getOrgBySlug, getOrgFeed } from "@/lib/org";
import { isNetworkHost, networkHostWithPort, normalizeDomain } from "@/lib/domain";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";
import { FollowButton } from "@/components/sites/FollowButton";
import { JoinWorkshopButton } from "@/components/sites/workshop/JoinWorkshopButton";

export const dynamic = "force-dynamic";

/**
 * The org's own page — who they are, in the classified/yellow-pages register
 * ArtDirect established for people.
 *
 * Identity here is the organisation's own `users` row (migration 099), not a
 * member's: before that column existed this page could only have shown an
 * arbitrary member's photo and bio in the org's name.
 *
 * Built in this app's own Tailwind/shadcn stack rather than importing
 * ArtDirect's dossier template, which ships a global dark body style and its
 * own non-Tailwind CSS — the classified feel is borrowed (mono labels, rules,
 * tag chips), the machinery is not. The org's full directory entry lives on
 * ArtDirect and is linked.
 */
export default async function SiteProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const identity = await getOrgIdentity(slug);
  const user = await getCurrentUser();

  const h = await headers();
  const host = h.get("host") ?? networkHostWithPort();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const requestDomain = normalizeDomain(host);
  const arrivedOnOwnDomain =
    h.get("x-org-domain") !== null ||
    (identity?.primaryDomain != null && requestDomain === identity.primaryDomain) ||
    (requestDomain !== null && !isNetworkHost(requestDomain));
  const mainSiteUrl =
    identity?.primaryDomain && !arrivedOnOwnDomain
      ? `https://${identity.primaryDomain}`
      : null;

  const rootHost = host.replace(new RegExp(`^${slug}\\.`), "");
  const loginUrl = `${proto}://${rootHost}/login`;
  const artdirectUrl = process.env.NEXT_PUBLIC_ARTDIRECT_URL;

  const [followers, following, members, feed, offering] = await Promise.all([
    getOrgFollowerCount(org.id),
    user ? isFollowingOrg(user.id, org.id) : Promise.resolve(false),
    listOrgMembers(org.id),
    getOrgFeed(org.id, 12),
    getOfferingThread(org.id),
  ]);

  // What else is on: everything published bar the one thing /offering is
  // already promoting. The free tier's site is these three pages, so without
  // this list an org's other work would be unreachable from its own site.
  const upcoming = feed.filter((t) => t.id !== offering?.id);

  // Workshops are the one kind you can be *inside*, so their row carries the
  // way in — join, or step through to the workspace if you already have.
  const enrolledWorkshops = new Set<string>();
  if (user) {
    await Promise.all(
      upcoming
        .filter((t) => t.kind === "workshop")
        .map(async (t) => {
          if (await isEnrolledInWorkshop(t.id, user.id)) enrolledWorkshops.add(t.id);
        })
    );
  }

  const place = [identity?.city, identity?.region, identity?.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeStyle orgId={org.id} pageKey="profile" />
      <SiteNav orgName={org.name} current="profile" mainSiteUrl={mainSiteUrl} />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-8">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {org.tier === "partner"
                ? "Partner organisation"
                : org.tier === "supported"
                ? "Supported organisation"
                : "Organisation"}
            </p>
            <h1 className="mt-2 font-serif text-4xl leading-tight">{org.name}</h1>
            {identity?.headline && (
              <p className="mt-2 text-base text-muted-foreground">{identity.headline}</p>
            )}
            {place && (
              <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {place}
              </p>
            )}
          </div>
          {identity?.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.avatarUrl}
              alt=""
              className="h-24 w-24 shrink-0 rounded-md border border-border object-cover"
            />
          )}
        </div>

        <div className="mt-6">
          <FollowButton
            orgSlug={slug}
            signedIn={Boolean(user)}
            following={following}
            count={followers}
            loginUrl={loginUrl}
          />
        </div>

        {identity?.bio && (
          <section className="mt-10">
            <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              About
            </h2>
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed">
              {identity.bio}
            </p>
          </section>
        )}

        {identity && identity.socialLinks.length > 0 && (
          <section className="mt-10">
            <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Elsewhere
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {identity.socialLinks.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener"
                    className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent"
                  >
                    {l.label ?? l.url.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Upcoming &amp; recent
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing else published just now.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {upcoming.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <a
                    href={t.slug ? `/${t.slug}` : "#"}
                    className="min-w-0 flex-1 hover:opacity-80"
                  >
                    <span className="block font-serif text-base">{t.title}</span>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      {t.kind}
                      {t.scheduled_at &&
                        ` · ${new Date(t.scheduled_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}`}
                    </span>
                  </a>
                  {t.kind === "workshop" && t.slug && (
                    <JoinWorkshopButton
                      threadId={t.id}
                      workshopSlug={t.slug}
                      signedIn={Boolean(user)}
                      enrolled={enrolledWorkshops.has(t.id)}
                      loginUrl={loginUrl}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            People
          </h2>
          {members.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No members listed.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="rounded-full border border-border px-3 py-1 text-sm"
                >
                  {m.displayName ?? m.email}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-dashed border-border p-5">
            <h3 className="font-serif text-lg">Forum</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Members-only discussion for {org.name}. Coming soon.
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-border p-5">
            <h3 className="font-serif text-lg">Blog</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Longer writing from the org. Coming soon.
            </p>
          </div>
        </section>

        {artdirectUrl && identity?.profileSlug && (
          <p className="mt-10 text-sm">
            <a
              className="underline underline-offset-4"
              href={`${artdirectUrl}/${identity.profileSlug}`}
              target="_blank"
              rel="noopener"
            >
              Full directory entry on ArtDirect →
            </a>
          </p>
        )}
      </main>

      <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
    </div>
  );
}
