import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "@/blocks/mobile/flow.css";
import "@/blocks/mobile/people.css";
import { ArchFrame, BackButton, CatalogueRow, Porthole, SectionHeader } from "@/components/mobile";
import { getPerson } from "@/lib/people";
import { formatDeparture } from "@/lib/tours";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPerson(slug).catch(() => null);
  return p ? { title: p.name, description: p.bio?.slice(0, 160) ?? undefined } : {};
}

/**
 * Artist profile (08) and Guide profile (09), G4. A code screen with fixed labels: artists in verdigris with a
 * porthole, guides in brass with an arch. Hidden when empty: tours, experiences, "Shared by" posts and the ArtDirect
 * link. The works grid and a guide's favourite places have no data yet (places favourites need a migration), so they
 * are not drawn. Desktop shows the same page in a centred 480px column.
 */
export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPerson(slug).catch(() => null);
  if (!p) notFound();
  const artist = p.isArtist && !p.isGuide;
  const first = p.name.split(/\s+/)[0] ?? p.name;
  const sub = [p.craft, p.area].filter(Boolean).join(" · ");

  return (
    <div className="elk-m m-col">
      <div className="m-flow-top">
        <BackButton href="/people" />
      </div>
      <header className={`m-prof ${artist ? "is-artist" : "is-guide"}`}>
        {artist ? <Porthole size={150} verdigris src={p.photoUrl} initial={p.name.slice(0, 1)} /> : <ArchFrame w={150} h={180} bottom={18} brass src={p.photoUrl} />}
        <span className="m-kicker">{artist ? "Artist" : "Guide"}</span>
        <h1 className="m-prof-name">{p.name}</h1>
        {sub && <span className="m-prof-sub">{sub}</span>}
      </header>
      {p.bio && <p className="m-prof-bio m-dropcap">{p.bio}</p>}

      {p.experiences.length > 0 && (
        <>
          <SectionHeader label={artist ? "Experiences" : `${first}'s experiences`} />
          <div className="m-prof-list">
            {p.experiences.map((e) => (
              <CatalogueRow key={e.id} href={`/experiences/${e.slug}`} title={e.title} meta={e.excerpt ?? undefined} thumb={<Porthole size={52} verdigris src={e.coverImageUrl} initial={e.title.slice(0, 1)} />} />
            ))}
          </div>
        </>
      )}

      {p.tours.length > 0 && (
        <>
          <SectionHeader label={artist ? `Find ${first} on` : `Tours with ${first}`} />
          <div className="m-prof-list">
            {p.tours.map(({ tour, next }) => (
              <CatalogueRow
                key={tour.id}
                href={`/tours/${tour.slug}`}
                title={tour.title}
                meta={next ? formatDeparture(next.startsAt) : "Dates coming"}
                thumb={<ArchFrame w={44} h={52} bottom={7} brass src={tour.coverImageUrl} />}
              />
            ))}
          </div>
        </>
      )}

      {p.favouritePlaces.length > 0 && (
        <>
          <SectionHeader label={`${first}'s favourite places`} />
          <div className="m-chip-row" style={{ flexWrap: "wrap" }}>
            {p.favouritePlaces.map((pl) => (
              <Link key={pl.id} href={`/people/${p.slug}?place=${pl.slug}`} className="m-chip" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} scroll={false}>{pl.title}</Link>
            ))}
          </div>
        </>
      )}

      {p.posts.length > 0 && (
        <>
          <SectionHeader label={`Shared by ${first}`} />
          <div className="m-prof-list">
            {p.posts.map((post) => (
              <CatalogueRow key={post.id} href={post.forumHref} kicker={post.kind === "link" ? `Link · ${post.link?.host ?? ""}` : "Post"} title={post.title} meta={post.excerpt ?? undefined} />
            ))}
          </div>
        </>
      )}

      {p.artDirectUrl && (
        <Link href={p.artDirectUrl} className="m-prof-link">
          See {first}&apos;s portfolio on ArtDirect
        </Link>
      )}
    </div>
  );
}
