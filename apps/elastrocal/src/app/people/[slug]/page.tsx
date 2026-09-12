import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrgProfileBySlug, listServiceOfferings } from "@elkdonis/services";
import { ProfileView } from "@elkdonis/cms-ui/profile";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { priceLabel } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getOrgProfileBySlug(siteConfig.orgId, slug).catch(() => null);
  return p ? { title: p.displayName, description: p.headline ?? undefined } : {};
}

/**
 * A guide's public page: the shared ProfileView (identity from users,
 * listing from org_profiles), followed by the services they offer here.
 */
export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [profile, viewer] = await Promise.all([
    getOrgProfileBySlug(siteConfig.orgId, slug).catch(() => null),
    getViewer().catch(() => null),
  ]);
  if (!profile || (!profile.isPublic && viewer?.userId !== profile.userId)) notFound();

  const isSelf = viewer?.userId === profile.userId;
  const services = (await listServiceOfferings(siteConfig.orgId).catch(() => [])).filter(
    (s) => s.authorId === profile.userId,
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/people" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
        ← People
      </Link>
      <div className="mt-6">
        <ProfileView
          person={{
            displayName: profile.displayName,
            headline: profile.roleTitle ?? profile.headline,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            pronouns: profile.pronouns,
            city: profile.city,
            verified: profile.verified,
            portfolioUrl: profile.portfolioUrl,
            socialLinks: profile.socialLinks,
          }}
          isSelf={isSelf}
          editor={
            isSelf ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/hub/profile">Edit profile</Link>
              </Button>
            ) : undefined
          }
        >
          {services.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Readings &amp; sessions</h2>
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                {services.map((s) => (
                  <li key={s.id}>
                    <Link href={`/services/${s.slug}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-accent">
                      <span>
                        <span className="block font-medium">{s.title}</span>
                        {s.descriptionShort && <span className="block text-sm text-muted-foreground">{s.descriptionShort}</span>}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">{priceLabel(s.price, s.currency, s.priceSlidingMin)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </ProfileView>
      </div>
    </div>
  );
}
