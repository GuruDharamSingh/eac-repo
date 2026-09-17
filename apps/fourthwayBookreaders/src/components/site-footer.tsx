import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteFooter({ blurb }: { blurb?: string | null }) {
  return (
    <footer className="sitefoot">
      <div className="column">
        <div className="sitefoot__grid">
          <div>
            <h3>{siteConfig.orgName}</h3>
            <p style={{ margin: 0, opacity: 0.88, maxWidth: "46ch" }}>
              {blurb ?? siteConfig.missionLine}
            </p>
          </div>
          <div>
            <h3>Read</h3>
            <ul>
              <li><Link href="/books">The books</Link></li>
              <li><Link href="/groups">Reading groups</Link></li>
              <li><Link href="/archive">Archive</Link></li>
              <li><Link href="/calendar">Calendar</Link></li>
            </ul>
          </div>
          <div>
            <h3>Take part</h3>
            <ul>
              <li><Link href="/suggest">Suggest a book</Link></li>
              <li><Link href="/center">Your center</Link></li>
              <li><Link href="/account">Account</Link></li>
              <li><Link href="/login">Sign in</Link></li>
            </ul>
          </div>
        </div>
        <p className="sitefoot__fine">
          Part of the Elkdonis Arts Collective network. Sessions are read aloud;
          everyone is welcome to listen.
        </p>
      </div>
    </footer>
  );
}
