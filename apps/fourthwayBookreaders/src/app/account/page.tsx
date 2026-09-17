import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@elkdonis/db";
import { getProfile } from "@elkdonis/services";
import { SignOutButton } from "@/components/sign-out-button";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { formatWhen } from "@/lib/format";

export const metadata: Metadata = { title: "Your account" };

interface RsvpRow {
  thread_id: string;
  title: string;
  section: string | null;
  slug: string | null;
  scheduled_at: Date | null;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  guide: "Guide",
  member: "Member",
  viewer: "Follower",
};

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");

  const [profile, rsvps] = await Promise.all([
    getProfile(viewer.userId).catch(() => null),
    // What this person has said yes to, on THIS site only.
    db<RsvpRow[]>`
      SELECT r.thread_id, t.title, t.section, t.slug, t.scheduled_at
      FROM thread_rsvps r
      JOIN threads t ON t.id = r.thread_id
      WHERE r.user_id = ${viewer.userId}
        AND t.org_id = ${siteConfig.orgId}
        AND r.status = 'yes'
      ORDER BY t.scheduled_at ASC NULLS LAST
      LIMIT 25
    `.catch(() => [] as RsvpRow[]),
  ]);

  return (
    <div className="column band">
      <p className="eyebrow">{siteConfig.orgName}</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>Your account</h1>

      <div className="split" style={{ marginTop: 22 }}>
        <div className="card">
          <h2 className="card__title">Sign-in</h2>
          <p className="card__body">
            <strong>{profile?.displayName?.trim() || viewer.email}</strong>
            <br />
            <span style={{ color: "var(--ink-muted)" }}>{viewer.email}</span>
          </p>
          <p className="card__meta" style={{ marginTop: 10 }}>
            <span>Here you are: {viewer.role ? ROLE_LABEL[viewer.role] ?? viewer.role : "a visitor"}</span>
          </p>
          <p className="card__body" style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
            This account works across every site in the Elkdonis network. Your
            role is set separately on each one.
          </p>
          <div className="card__actions">
            <Link href={viewer.isMember ? "/hub" : "/center"} className="btn btn--primary">
              {viewer.isMember ? "Open the hub" : "Open your center"}
            </Link>
            {viewer.canEdit && <Link href="/manage" className="btn">Manage the site</Link>}
            <SignOutButton />
          </div>
        </div>

        <div className="card">
          <h2 className="card__title">Readings you&rsquo;re coming to</h2>
          {rsvps.length === 0 ? (
            <p className="card__body" style={{ color: "var(--ink-muted)" }}>
              Nothing yet. <Link href="/groups">See the reading groups.</Link>
            </p>
          ) : (
            <ul className="booklist">
              {rsvps.map((r) => (
                <li key={r.thread_id}>
                  <Link href={`/${r.section ?? "groups"}/${r.slug ?? r.thread_id}`}>
                    <span className="booklist__title">{r.title}</span>
                    <span className="booklist__author">{formatWhen(r.scheduled_at) ?? "date to come"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
