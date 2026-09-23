import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getProfileBySlug, listWriting } from "@elkdonis/services";
import { ProfileView } from "@elkdonis/cms-ui/profile";
import { WritingSection, StartPiece } from "@elkdonis/cms-ui/writing";
import { StoreShowcase } from "@elkdonis/commerce/components";
import { getStoreShowcaseForUser } from "@elkdonis/commerce/queries";
import { hasProfileSection, isMember } from "@/lib/members";
import { startPieceAction } from "@/lib/writing-actions";
import { getServerSession } from "@elkdonis/auth-server";
import { canEditProfile } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * A member's page.
 *
 * The profile is the NETWORK's — `getProfileBySlug` reads the same `users` +
 * `org_profiles` row ArtDirect and IFAC render — so somebody who has already
 * written a bio elsewhere in the network arrives here complete. This site
 * decides only two things: who is on the roster, and which optional sections
 * that person has switched on from their hub.
 *
 * The gate is MEMBERSHIP, not `directoryListed`. That flag is about appearing
 * in the public network directory; this is a group's own roster, and someone
 * who has opted out of the directory is still one of the five people here.
 */
export const dynamic = "force-dynamic";

/** Where a piece for sale actually lives. art-auction is the store. */
const MARKETPLACE_URL =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? "https://art.elkdonis-arts.org";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) return {};
  return {
    title: `${profile.displayName} — ${siteConfig.orgName}`,
    description: profile.headline ?? profile.bio?.slice(0, 160) ?? undefined,
  };
}

export default async function MemberPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile || !(await isMember(profile.userId))) notFound();

  // Whether the person reading this is the person it is about (or an admin).
  // It decides two things on the writing shelf: drafts show, and the way to
  // start a piece appears.
  const session = await getServerSession();
  const viewerId = session.user ? (session.user.db_user_id ?? session.user.id) : null;
  const editable = Boolean(viewerId && (await canEditProfile(viewerId, profile.userId)));

  // Optional sections, each switched on by the person themselves.
  const [showWriting, showStore] = await Promise.all([
    hasProfileSection(profile.userId, "blog"),
    hasProfileSection(profile.userId, "store"),
  ]);

  const [writing, storeShowcase] = await Promise.all([
    // Read across every org, not just this one: a member's writing is theirs,
    // and a shelf that hid the pieces they filed elsewhere would be a
    // confusing half-answer on their own page.
    showWriting
      ? listWriting(profile.userId, { includeDrafts: editable, limit: 5 }).catch(() => [])
      : [],
    showStore
      ? getStoreShowcaseForUser(profile.userId, { limit: 6 }).catch(() => null)
      : null,
  ]);

  const works = profile.portfolio.filter((w) => w.url);

  return (
    <main className="hub">
      <div className="hub-band">
        <p className="hub-kicker">
          <Link href="/artists">← The people</Link>
        </p>
      </div>

      <ProfileView
        person={{
          displayName: profile.displayName,
          headline: profile.headline,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          pronouns: profile.pronouns,
          city: profile.city,
          verified: profile.verified,
          portfolioUrl: profile.portfolioUrl,
          socialLinks: profile.socialLinks,
        }}
        gallery={
          works.length > 0 ? (
            <div className="eac-profile-grid">
              {works.map((w, i) => (
                <figure key={w.id ?? `${slug}-${i}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.url} alt={w.title ?? ""} loading="lazy" />
                  {w.title && <figcaption>{w.title}</figcaption>}
                </figure>
              ))}
            </div>
          ) : undefined
        }
      >
        {/* The same section IFAC's profiles carry — shelf, drafts for the
            owner, the way to start a piece, and the link to the rest. Shared,
            so the two sites cannot drift into two different blogs. */}
        {showWriting && (
          <WritingSection
            items={writing}
            basePath={`/artists/${slug}/writing`}
            editable={editable}
            startPiece={
              editable ? (
                <StartPiece
                  onCreate={startPieceAction.bind(null, profile.userId)}
                  basePath={`/artists/${slug}/writing`}
                />
              ) : undefined
            }
          />
        )}

        {storeShowcase && (
          <section className="hub-band" aria-labelledby="member-store">
            <div className="hub-band-head">
              <h2 id="member-store">Available work</h2>
              <p>Pieces {profile.displayName} is selling through the marketplace.</p>
            </div>
            <StoreShowcase
              store={storeShowcase.store}
              artworks={storeShowcase.artworks}
              marketplaceUrl={MARKETPLACE_URL}
              from={siteConfig.orgId}
              heading=""
              columns={3}
            />
          </section>
        )}
      </ProfileView>
    </main>
  );
}
