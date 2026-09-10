import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { ThreadCard } from "@/components/thread-card";
import { getGuideBySlug, getThreadsByAuthor } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { toPlainText } from "@/lib/format";

interface MemberPageProps {
  params: Promise<{ slug: string }>;
}

const ARTDIRECT_URL = process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013";

export async function generateMetadata({ params }: MemberPageProps): Promise<Metadata> {
  const { slug } = await params;
  const member = await getGuideBySlug(slug);
  if (!member) return {};
  return { title: member.displayName, description: member.roleTitle ?? toPlainText(member.bio, 160) };
}

/**
 * A member's page.
 *
 * The profile is the member's own — `users` plus this org's `org_profiles`
 * row — and it is edited on ArtDirect, where every member of the network
 * keeps one profile that each site reads. So this page has no editor: the
 * owner sees a link to ArtDirect, and what they change there shows here.
 * Everything they have published on this site follows, because a page that
 * is only a bio goes stale and one that lists their work does not.
 */
export default async function MemberPage({ params }: MemberPageProps) {
  const { slug } = await params;
  const [member, viewer] = await Promise.all([getGuideBySlug(slug), getViewer().catch(() => null)]);
  if (!member) notFound();

  const threads = await getThreadsByAuthor(member.userId);
  const isOwner = viewer?.userId === member.userId;
  const initials = member.displayName.charAt(0);

  return (
    <div className="ig-page">
      <Link href="/about" className="ig-kicker" style={{ textDecoration: "none" }}>← The Collective</Link>

      <header className="ig-member-hero" style={{ marginTop: "1.5rem" }}>
        {member.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.photoUrl} alt="" />
        ) : (
          <span className="ig-member-initials" aria-hidden style={{ width: 180, height: 180, fontSize: "3rem" }}>{initials}</span>
        )}
        <div>
          <h1>{member.displayName}</h1>
          {member.roleTitle && <p className="ig-member-title" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>{member.roleTitle}</p>}
          {member.city && <p className="ig-kicker" style={{ marginTop: "0.35rem", color: "#104b8C" }}>{member.city}</p>}
          {(isOwner || viewer?.canEdit) && (
            <a className="ig-edit-link" href={`${ARTDIRECT_URL}/${member.slug}`} target="_blank" rel="noreferrer">
              {isOwner ? "Edit your profile on ArtDirect →" : "Open on ArtDirect →"}
            </a>
          )}
        </div>
      </header>

      {member.bio && (
        <div className="prose-amrit" style={{ marginTop: "2rem" }}>
          {member.bio.includes("<") ? (
            <div dangerouslySetInnerHTML={{ __html: member.bio }} />
          ) : (
            member.bio.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
          )}
        </div>
      )}

      {member.socialLinks.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-3">
          {member.socialLinks
            .filter((l) => l.url)
            .map((link, i) => (
              <li key={i}>
                <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-sm hover:bg-accent/20" style={{ fontFamily: '"Venture", serif', letterSpacing: "0.08em" }}>
                  {link.label ?? link.url}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
        </ul>
      )}

      {threads.length > 0 && (
        <section style={{ marginTop: "3rem" }}>
          <hr className="saffron-divider" />
          <h2 className="ig-h2">With {member.displayName.split(" ")[0]}</h2>
          <div className="mt-5 grid gap-5">
            {threads.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} feedName={thread.feedSlug === "blog" ? "Blog" : "Offerings"} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
