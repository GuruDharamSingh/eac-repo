import type { Metadata } from "next";
import Link from "next/link";
import { listMembers } from "@/lib/members";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The people" };

/**
 * The group's roster.
 *
 * Each card opens that person's page, which is the NETWORK profile — so
 * somebody who has already written a bio on ArtDirect or IFAC arrives here
 * complete rather than blank.
 */
export default async function MembersPage() {
  const members = await listMembers();

  return (
    <main className="hub">
      <div className="hub-welcome">
        <div>
          <p className="hub-kicker">{siteConfig.orgName}</p>
          <h1>The people</h1>
          <p className="hub-welcome-sub">
            Everyone who gathers here. A page each — bio, work, and whatever
            they have chosen to show.
          </p>
        </div>
      </div>

      <section className="hub-band">
        {members.length === 0 ? (
          <p className="eac-rota-empty">Nobody has a page yet.</p>
        ) : (
          <ul className="eac-people">
            {members.map((m) => (
              <li key={m.userId}>
                <Link className="eac-person" href={`/artists/${m.slug}`}>
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${m.avatarUrl}${m.avatarUrl.includes("?") ? "&" : "?"}w=256`} alt="" loading="lazy" />
                  ) : (
                    <span className="eac-person__blank" aria-hidden />
                  )}
                  <span className="eac-person__id">
                    <strong>{m.displayName}</strong>
                    {m.headline && <em>{m.headline}</em>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
