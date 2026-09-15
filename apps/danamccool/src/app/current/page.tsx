import Link from "next/link";
import { CURRENT_UPCOMING } from "@/lib/content";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Current & Upcoming" };

export default function CurrentUpcomingPage() {
  return (
    <article className="content-page">
      <h1 className="page-title">Current &amp; Upcoming</h1>
      <p>
        {CURRENT_UPCOMING.intro.replace("ELKDONIS ARTS COLLECTIVE", "")}
        {" "}
        <a href={siteConfig.elkdonisArtsUrl} target="_blank" rel="noreferrer">
          Elkdonis Arts Collective
        </a>{" "}
        is an international not for profit organization and community she is currently developing as
        a Co-Founder. This is her most active and recent project — please feel free to reach out with
        inquiries.
      </p>
      <ul className="hub-list" style={{ marginTop: "2rem" }}>
        <li>
          <Link href="/exhibitions">Past Exhibitions</Link>
        </li>
        <li>
          <Link href="/workshops">Workshops &amp; Teaching</Link>
        </li>
        <li>
          <Link href="/publications">Publications</Link>
        </li>
      </ul>
    </article>
  );
}
