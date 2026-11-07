import Link from "next/link";
import type { Metadata } from "next";
import { getProfileBySlug } from "@elkdonis/services";
import { getGuideBySlug, getSiteSections } from "@/lib/data";
import { featuredThread, latestThread, type ThreadTeaser } from "@/lib/public-site";
import { toPlainText } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { SiteShell } from "@/lib/series-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: `About ${siteConfig.orgName} and the Elkdonis Arts Collective.`,
};

/**
 * About (2026-11-02): the guide's card (9:16, a third of the width) beside a flat org card and the org's
 * description; a banner with the latest and the featured thread; the Elkdonis Arts Collective.
 * The collective's words are the ones on its own site (apps/innergathering/src/app/page.tsx).
 */
export default async function AboutPage() {
  const [guide, sections] = await Promise.all([getGuideBySlug(siteConfig.guideSlug).catch(() => null), getSiteSections()]);
  const [person, latest, featured] = await Promise.all([
    guide ? getProfileBySlug(guide.slug).catch(() => null) : null,
    latestThread(),
    featuredThread(guide?.userId ?? null),
  ]);
  const about = sections.about ?? {};
  const hero = sections.hero ?? {};
  const paragraphs = (about.body ?? "").split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const links = (person?.socialLinks ?? []).filter((l) => l.url);

  return (
    <SiteShell>
      <div className="pts-snap">
        <section className="pts-panel" data-edit-section="about-people" data-edit-name="Who">
          <div className="pts-wrap pts-cq">
            <div className="pts-about">
              {guide && (
                <article className="pts-person" data-edit-name="Profile card">
                  {guide.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={guide.photoUrl} alt="" />
                  ) : (
                    <span className="pts-person__blank" aria-hidden="true">{guide.displayName.charAt(0)}</span>
                  )}
                  <div className="pts-person__words">
                    {guide.roleTitle && <p className="ifs-eyebrow">{guide.roleTitle}</p>}
                    <h1>{guide.displayName}</h1>
                    {guide.bio && <p>{toPlainText(guide.bio, 180)}</p>}
                    <p className="pts-person__links">
                      <Link href={`/about/${guide.slug}`}>Read more</Link>
                      {links.slice(0, 3).map((l) => (
                        <a key={l.url} href={l.url} rel="me noopener" target="_blank">{l.label?.trim() || hostOf(l.url)}</a>
                      ))}
                    </p>
                  </div>
                </article>
              )}
              <div className="pts-about__org">
                <article className="pts-orgcard" data-edit-name="Organization card">
                  <div>
                    <p className="ifs-eyebrow">{hero.eyebrow?.trim() || "Elkdonis Arts Collective"}</p>
                    <h2>{siteConfig.orgName}</h2>
                  </div>
                  <p>{hero.subtitle ?? siteConfig.tagline}</p>
                </article>
                <div className="pts-prose" data-edit-name="Description">
                  {paragraphs.map((p, i) =>
                    p.startsWith("mailto:") ? (
                      <p key={i}><a className="ifs-link" href={p}>{p.slice("mailto:".length)}</a></p>
                    ) : (
                      <p key={i}>{p}</p>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {(latest || featured) && (
          <section className="pts-panel pts-panel--flush" data-edit-section="about-threads" data-edit-name="Latest and featured">
            <div className="pts-threads">
              {latest && <ThreadBanner label="Latest" thread={latest} />}
              {featured && featured.href !== latest?.href && <ThreadBanner label="Featured" thread={featured} />}
            </div>
          </section>
        )}

        <section className="pts-panel pts-panel--line" data-edit-section="about-collective" data-edit-name="Elkdonis Arts Collective">
          <div className="pts-wrap pts-stack pts-measure">
            <p className="ifs-eyebrow">Made possible by</p>
            <h2 className="pts-h2">Elkdonis Arts Collective</h2>
            <blockquote className="pts-quote">
              The collective is committed to using art as the means of inquiry. Each inquiry focuses on a particular question that is grounded in what
              it is to be human. We are unique in our purpose and are not commercial. Our works are intended to be experienced, not sold.
            </blockquote>
            <p>
              Our original group was first formed in Newmarket Ontario, Canada, 1990. Our current international collaborations are focused in Paris,
              Los Angeles and Toronto and surrounds, where our founding members are respectively situated and engaged in a wide variety of creative acts
              &amp; inquiries.
            </p>
            <div><a className="ifs-btn" href={siteConfig.collectiveUrl}>Visit the collective</a></div>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function ThreadBanner({ label, thread }: { label: string; thread: ThreadTeaser }) {
  return (
    <Link className="pts-threadcard" href={thread.href}>
      {thread.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thread.imageUrl} alt="" loading="lazy" />
      )}
      <span className="pts-threadcard__words">
        <span className="ifs-eyebrow">{label}</span>
        <b>{thread.title}</b>
        {thread.excerpt && <span>{toPlainText(thread.excerpt, 160)}</span>}
      </span>
    </Link>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
