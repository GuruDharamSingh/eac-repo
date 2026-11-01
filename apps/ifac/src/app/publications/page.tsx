import type { Metadata } from "next";
import { listOrgWriting } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getSiteContent } from "@/lib/data";
import { fetchBlogPosts, formatPostDate } from "@/lib/blog-feed";
import { fetchChannelVideos, youtubeIdFromEmbed } from "@/lib/video-feed";
import { getPresentedSeries } from "@/lib/series";
import { PublicFooter, PublicHeader, PublicShell } from "@/components/site/chrome";

/**
 * Publications (new 2026-10-08): the IFAC blog, members' writing and the
 * YouTube channel, which the landing page used to carry in full.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Publications | ${siteConfig.shortName}`,
  description: "The IFAC blog, members' writing and videos.",
};

export default async function PublicationsPage() {
  const [content, series, videos, writing] = await Promise.all([
    getSiteContent(),
    getPresentedSeries({ count: 1 }),
    fetchChannelVideos(12),
    listOrgWriting(siteConfig.orgId, { limit: 12 }),
  ]);
  const posts = await fetchBlogPosts(content.blog.href, 12);
  const shelf = videos.length > 0 ? videos : content.videos.embeds.map((e) => ({ id: youtubeIdFromEmbed(e.src) ?? "", title: e.title })).filter((v) => v.id);
  const seriesHref = series ? `/series/${series.slug}` : null;

  return (
    <PublicShell>
      <PublicHeader active="publications" seriesHref={seriesHref} seriesLabel={series?.title ?? null} />

      <section className="ifs-section">
        <div className="ifs-wrap">
          <div className="ifs-section__head">
            <div><p className="ifs-eyebrow">Publications</p><h2>The IFAC blog</h2></div>
            <a className="ifs-link" href={content.blog.href} target="_blank" rel="noopener">Open the blog →</a>
          </div>
          {posts.length > 0 ? (
            <div className="ifs-pubs">
              {posts.map((p) => (
                <a key={p.id} className="ifs-pub" href={p.url} target="_blank" rel="noopener">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ifs-pub__img" src={p.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="ifs-pub__blank">IFAC</span>
                  )}
                  <span className="ifs-pub__body">
                    <span className="ifs-pub__k">{[p.author, formatPostDate(p.publishedAt)].filter(Boolean).join(" · ")}</span>
                    <span className="ifs-pub__t">{p.title}</span>
                    <span className="ifs-pub__s">{p.excerpt}</span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="ifs-faint">The blog feed is not reachable right now. <a className="ifs-link" href={content.blog.href}>Read it on Blogger</a>.</p>
          )}

          {writing.length > 0 && (
            <>
              <div className="ifs-section__head" style={{ marginTop: 56 }}>
                <div><p className="ifs-eyebrow">Members&apos; writing</p><h2>From the artists and dealers</h2></div>
              </div>
              <div className="ifs-pubs">
                {writing.map((w) => {
                  const href = w.author.slug ? `/${w.author.isDealer ? "dealers" : "artists"}/${w.author.slug}/writing/${w.slug}` : null;
                  const inner = (
                    <>
                      {w.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="ifs-pub__img" src={w.coverImageUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="ifs-pub__blank">IFAC</span>
                      )}
                      <span className="ifs-pub__body">
                        <span className="ifs-pub__k">{w.author.name}{w.readingMinutes ? ` · ${w.readingMinutes} min` : ""}</span>
                        <span className="ifs-pub__t">{w.title}</span>
                        {w.lede && <span className="ifs-pub__s">{w.lede}</span>}
                      </span>
                    </>
                  );
                  return href ? (
                    <a key={w.id} className="ifs-pub" href={href}>{inner}</a>
                  ) : (
                    <div key={w.id} className="ifs-pub">{inner}</div>
                  );
                })}
              </div>
            </>
          )}

          {shelf.length > 0 && (
            <>
              <div className="ifs-section__head" style={{ marginTop: 56 }}>
                <div><p className="ifs-eyebrow">Videos</p><h2>IFAC on YouTube</h2></div>
                <a className="ifs-link" href={content.videos.playlistUrl} target="_blank" rel="noopener">All videos →</a>
              </div>
              <div className="ifs-videos" style={{ marginTop: 0 }}>
                {shelf.map((v) => (
                  <a key={v.id} className="ifs-video" href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" />
                    <span className="ifs-video__play"><i /></span>
                    <span className="ifs-video__l">{v.title}</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <PublicFooter seriesHref={seriesHref} seriesLabel={series?.title ?? null} />
    </PublicShell>
  );
}
