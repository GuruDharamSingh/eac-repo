import type { Metadata } from "next";
import Link from "next/link";
import { listOrgMembers } from "@elkdonis/services";
import { SiteShell } from "@/components/site-shell";
import { ASSIGNABLE_ROLES, PURELAND_ORG, currentRelease, getPurelandViewer, getSaveSummary } from "@/lib/pureland";
import { PlayButton } from "./play-button";
import { CloudSaveToggle } from "./cloud-save-toggle";
import { DiagnosticsToggle } from "./diagnostics-toggle";
import { ManageMembers } from "./manage-members";
import "./pureland.css";

/**
 * arts-collective.com/pureland — Pureland, private to the BuddhasEngines org while it is tested
 * (src/lib/pureland.ts). Signed out: sign in. Signed in without a role: "private, ask an owner".
 * Members: the Buddha, Play Pureland, and "save my progress to my account". Owners also get
 * Manage (add members by email, set roles, remove).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pureland",
  robots: { index: false, follow: false },
};

export default async function PurelandPage() {
  const viewer = await getPurelandViewer();

  if (!viewer || !viewer.canPlay) {
    return (
      <SiteShell>
        <section className="pl-gate">
          <h1 className="pl-title">Pureland</h1>
          {viewer ? (
            <p className="pl-lede">This is private for now. Ask an owner of Buddha&apos;s Engines for access.</p>
          ) : (
            <>
              <p className="pl-lede">This is private for now. Sign in to play.</p>
              <Link className="pl-button" href={`/login?next=${encodeURIComponent("/pureland")}`}>
                Sign in
              </Link>
            </>
          )}
        </section>
      </SiteShell>
    );
  }

  const [save, release, members] = await Promise.all([
    getSaveSummary(viewer.userId),
    currentRelease(),
    viewer.canManage ? listOrgMembers(PURELAND_ORG) : Promise.resolve([]),
  ]);

  return (
    <SiteShell>
      <section className="pl-landing">
        <figure className="pl-hero">
          {/* A still from the game: a peak statue in the evening light. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pureland/buddha.jpg" alt="A golden Buddha statue on a mountain peak, from Pureland" width={1280} height={720} />
        </figure>
        <h1 className="pl-title">Pureland</h1>
        <PlayButton ready={release !== null} />
        {release === null && <p className="pl-note">The game hasn&apos;t been uploaded yet.</p>}
        <CloudSaveToggle enabled={save.enabled} savedAt={save.savedAt} bytes={save.bytes} />
        <DiagnosticsToggle />
      </section>

      {viewer.canManage && (
        <section className="pl-manage">
          <h2>Manage</h2>
          <p className="pl-note">
            Owners add people by the email they signed up with. Owners manage; guides and members (testers) play.
          </p>
          <ManageMembers
            selfId={viewer.userId}
            roles={ASSIGNABLE_ROLES}
            members={members
              .filter((m) => m.role !== "viewer")
              .map((m) => ({ userId: m.userId, email: m.email, name: m.displayName, role: m.role }))}
          />
          {release && <p className="pl-note">Live build: {release.id}</p>}
        </section>
      )}
    </SiteShell>
  );
}
