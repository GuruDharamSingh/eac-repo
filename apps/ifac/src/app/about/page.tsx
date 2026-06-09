import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { defaultSiteContent } from "@/lib/default-content";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "About — IFAC Team" };

const teamMembers = [
  { name: "Eric Brummel", role: "Artist, Art Dealer", href: "/artists/ericbrummel", photo: "/ifac/artists/ericbrummel/ericbrummel500.jpg" },
  { name: "Hans Maack", role: "Art Dealer, Audio/Video", href: "/dealers/hansmaack", photo: "/ifac/dealers/hansmaack/hans400.jpg" },
  { name: "Berni Laplante", role: "Art Dealer, Blog Writer", href: "/dealers/bernilaplante", photo: "/ifac/dealers/bernilaplante/BERNIS31.jpg" },
  { name: "Iven Lourie", role: "Artist, Auctioneer", href: undefined, photo: "/ifac/about/iven1.jpg" },
  { name: "Michele DeParis", role: "Artist, Consultant", href: "/artists/micheledeparis", photo: "/ifac/artists/micheledeparis/michelemarie.jpg" },
  { name: "William Albin", role: "Art Dealer, Liaison", href: "/dealers/billalbin", photo: "/ifac/dealers/billalbin/billalbin500.png" },
  { name: "Kevin Meadows", role: "Art Dealer, Audio/Video", href: "/dealers/kevinmeadows", photo: "/ifac/dealers/kevinmeadows/kevin 500.png" },
  { name: "Jaswant Bains", role: "Artist, Art Classes", href: "/artists/jaswantbains", photo: "/ifac/artists/jaswantbains/jazzy1.png" },
  { name: "Grant Abrams", role: "Coin & Art Dealer, Auctioneer", href: undefined, photo: "/ifac/about/Grant1.jpg" },
  { name: "Michael McDonnell", role: "Art Dealer", href: "/dealers/mmcdonnell", photo: "/ifac/about/mike.jpg" },
];

export default function AboutPage() {
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
            {teamMembers.map((member) => {
              const inner = (
                <>
                  <img src={encodeSpaces(member.photo)} alt={member.name} className="team-photo" loading="lazy" />
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
