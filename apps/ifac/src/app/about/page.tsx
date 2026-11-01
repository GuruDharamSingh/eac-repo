import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { listDirectory } from "@/lib/directory";
import { getPresentedSeries } from "@/lib/series";
import { PublicFooter, PublicHeader, PublicShell } from "@/components/site/chrome";

/**
 * About IFAC (reshaped 2026-10-08, revised the same evening to the old
 * page's shape): the team statement in a bordered block, the team as
 * portrait cards, then the artists and dealers as the landing page used
 * to list them. Individual artist and dealer pages are unchanged.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `About — IFAC Team | ${siteConfig.shortName}`,
  description: "Who International Fine Art Collectors are: the team, the artists and the dealers.",
};

const SITE_IMAGES = "/api/media/EAC_Network/ifac/Media/Images/Site/";

/** The team, as the previous About page listed them (owner's list). */
const TEAM: Array<{ name: string; role: string; slug?: string; photo?: string }> = [
  { name: "Eric Brummel", role: "Artist, Art Dealer", slug: "eric-brummel" },
  { name: "Hans Maack", role: "Art Dealer, Audio/Video", slug: "hansmaack" },
  { name: "Berni Laplante", role: "Art Dealer, Blog Writer", slug: "bernilaplante" },
  { name: "Iven Lourie", role: "Artist, Auctioneer", photo: `${SITE_IMAGES}iven1.jpg` },
  { name: "Michele DeParis", role: "Artist, Consultant", slug: "micheledeparis" },
  { name: "William Albin", role: "Art Dealer, Liaison", slug: "billalbin" },
  { name: "Kevin Meadows", role: "Art Dealer, Audio/Video", slug: "kevinmeadows" },
  { name: "Jaswant Bains", role: "Artist, Art Classes", slug: "jaswantbains" },
  { name: "Grant Abrams", role: "Coin & Art Dealer, Auctioneer", photo: `${SITE_IMAGES}Grant1.jpg` },
  { name: "Michael McDonnell", role: "Art Dealer", slug: "mmcdonnell" },
];

export default async function AboutPage() {
  const [artists, dealers, series] = await Promise.all([listDirectory("artist"), listDirectory("dealer"), getPresentedSeries({ count: 1 })]);
  const seriesHref = series ? `/series/${series.slug}` : null;
  const bySlug = new Map([...artists, ...dealers].map((p) => [p.slug, p]));
  // Fallback by name: claiming a placeholder profile can change the slug
  // (kevinmeadows -> kevin-meadows, 2026-10-10), which left this card unlinked.
  const byName = new Map([...artists, ...dealers].map((p) => [p.name.trim().toLowerCase(), p]));

  const team = TEAM.map((t) => {
    const p = (t.slug ? bySlug.get(t.slug) : undefined) ?? byName.get(t.name.trim().toLowerCase());
    return {
      name: t.name,
      role: t.role,
      photo: p?.portrait || (t.photo ? encodeURI(t.photo) : null),
      href: p ? `/${p.kind}s/${p.slug}` : null,
    };
  });

  return (
    <PublicShell>
      <PublicHeader active="about" seriesHref={seriesHref} seriesLabel={series?.title ?? null} />

      <div className="ifs-wrap">
        <h1 className="ifs-page-h1">About IFAC</h1>

        <section className="ifs-block" aria-label="Statement">
          <div className="ifs-statement">
            <p>Welcome to the IFAC website! We&apos;re happy you found your way here. We are a group of folks who have joined together to provide currency in the art world. Currency, you say? Let&apos;s define currency as directions of flow. This reflects our personal histories as artists, collectors, and dealers of beauty, commonly referred to as &lsquo;art.&rsquo;</p>
            <p>We are in the business of promoting what we have found that meets our criteria across a wide range of interests, the specifics of which can be gleaned from our blog topics.</p>
            <p>We are unabashedly enthusiastic regarding our selections and invite engagement here and on our many nascent social media sites. Our goal is to help artists and art dealers show their art to the world.</p>
            <p>And by the way, we don&apos;t take ourselves too seriously, just our mission.</p>
            <p className="ifs-sig">— Eric Brummel</p>
          </div>
        </section>

        <section className="ifs-block" aria-labelledby="artists-h">
          <div className="ifs-block__head"><h2 className="ifs-block__h" id="artists-h">Artists</h2></div>
          <Roster people={artists} />
        </section>

        <section className="ifs-block" aria-labelledby="dealers-h">
          <div className="ifs-block__head"><h2 className="ifs-block__h" id="dealers-h">Art Dealers</h2></div>
          <Roster people={dealers} />
        </section>

        <section className="ifs-block" aria-labelledby="team-h">
          <div className="ifs-block__head"><h2 className="ifs-block__h" id="team-h">The Team</h2></div>
          <div className="ifs-roster">
            {team.map((m) => {
              const inner = (
                <>
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo} alt="" loading="lazy" />
                  ) : (
                    <i aria-hidden="true">{m.name.charAt(0)}</i>
                  )}
                  <span className="ifs-roster__txt">
                    <span>{m.name}</span>
                    <span className="ifs-roster__role">{m.role}</span>
                  </span>
                </>
              );
              return m.href ? (
                <a key={m.name} href={m.href}>{inner}</a>
              ) : (
                <div key={m.name}>{inner}</div>
              );
            })}
          </div>
        </section>

        <p className="ifs-faint" style={{ margin: "8px 0 28px", fontSize: "0.92rem" }}>
          Artist or dealer with IFAC? <a className="ifs-link" href="/login?mode=signup&next=/hub">Create an account</a> to claim your page.
        </p>
      </div>

      <PublicFooter seriesHref={seriesHref} seriesLabel={series?.title ?? null} />
    </PublicShell>
  );
}

function Roster({ people }: { people: Array<{ slug: string; name: string; kind: "artist" | "dealer"; portrait: string; role: string }> }) {
  if (people.length === 0) return <p className="ifs-faint">Nobody listed yet.</p>;
  return (
    <div className="ifs-roster">
      {people.map((p) => (
        <a key={p.slug} href={`/${p.kind}s/${p.slug}`}>
          {p.portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.portrait} alt="" loading="lazy" />
          ) : (
            <i aria-hidden="true">{p.name.charAt(0)}</i>
          )}
          <span className="ifs-roster__txt">
            <span>{p.name}</span>
            {p.role && <span className="ifs-roster__role">{p.role}</span>}
          </span>
        </a>
      ))}
    </div>
  );
}
