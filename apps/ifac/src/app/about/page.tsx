import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { defaultSiteContent } from "@/lib/default-content";
import { getDirectoryProfile } from "@/lib/directory";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "About — IFAC Team" };

const SITE_IMAGES = "/api/media/EAC_Network/ifac/Media/Images/Site/";

/**
 * The team. A member with a profile (`slug`) is shown with THEIR portrait —
 * the avatar in their own Nextcloud folder, the same picture their profile
 * page shows — so a new photo appears here without editing this file. Only
 * the two people with no account on the network have a picture of their own
 * here, and it lives in IFAC's Nextcloud folder, not in the app bundle.
 */
const teamMembers: Array<{ name: string; role: string; slug?: string; kind?: "artists" | "dealers"; photo?: string }> = [
  { name: "Eric Brummel", role: "Artist, Art Dealer", slug: "ericbrummel", kind: "artists" },
  { name: "Hans Maack", role: "Art Dealer, Audio/Video", slug: "hansmaack", kind: "dealers" },
  { name: "Berni Laplante", role: "Art Dealer, Blog Writer", slug: "bernilaplante", kind: "dealers" },
  { name: "Iven Lourie", role: "Artist, Auctioneer", photo: `${SITE_IMAGES}iven1.jpg` },
  { name: "Michele DeParis", role: "Artist, Consultant", slug: "micheledeparis", kind: "artists" },
  { name: "William Albin", role: "Art Dealer, Liaison", slug: "billalbin", kind: "dealers" },
  { name: "Kevin Meadows", role: "Art Dealer, Audio/Video", slug: "kevinmeadows", kind: "dealers" },
  { name: "Jaswant Bains", role: "Artist, Art Classes", slug: "jaswantbains", kind: "artists" },
  { name: "Grant Abrams", role: "Coin & Art Dealer, Auctioneer", photo: `${SITE_IMAGES}Grant1.jpg` },
  { name: "Michael McDonnell", role: "Art Dealer", slug: "mmcdonnell", kind: "dealers" },
];

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  // Each member's live profile: their portrait, and whether their page is up.
  const profiles = await Promise.all(teamMembers.map((m) => (m.slug ? getDirectoryProfile(m.slug) : undefined)));
  const team = teamMembers.map((m, i) => {
    const profile = profiles[i];
    return {
      ...m,
      photo: profile?.portrait || m.photo || "",
      // An unlisted profile is not linked to.
      href: profile && m.kind ? `/${m.kind}/${m.slug}` : undefined,
    };
  });

  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <div className="profile-intro">
          <a className="profile-back" href="/">← Home</a>
          <h1 className="profile-name">IFAC Team</h1>
        </div>

        <div className="about-body">
          <div className="about-statement">
            <p>Welcome to the IFAC website! We're happy you found your way here. We are a group of folks who have joined together to provide currency in the art world. Currency, you say? Let's define currency as directions of flow. This reflects our personal histories as artists, collectors, and dealers of beauty, commonly referred to as 'art.'</p>
            <p>We are in the business of promoting what we have found that meets our criteria across a wide range of interests, the specifics of which can be gleaned from our blog topics.</p>
            <p>We are unabashedly enthusiastic regarding our selections and invite engagement here and on our many nascent social media sites. Our goal is to help artists and art dealers show their art to the world.</p>
            <p>And by the way, we don't take ourselves too seriously — just our mission.</p>
            <p className="about-sig">– Eric Brummel</p>
          </div>

          <div className="team-grid">
            {team.map((member) => {
              const inner = (
                <>
                  {member.photo ? (
                    <img src={encodeSpaces(member.photo)} alt={member.name} className="team-photo" loading="lazy" />
                  ) : (
                    <span className="team-photo" aria-hidden="true" />
                  )}
                  <p className="team-name">{member.name}</p>
                  <p className="team-role">{member.role}</p>
                </>
              );
              return member.href ? (
                <a key={member.name} href={member.href} className="team-card">
                  {inner}
                </a>
              ) : (
                <div key={member.name} className="team-card">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <SiteFooter content={defaultSiteContent.footer} />
    </div>
  );
}

function encodeSpaces(path: string): string {
  return path.replace(/ /g, "%20");
}
