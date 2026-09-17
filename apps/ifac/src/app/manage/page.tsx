import Link from "next/link";
import { getOrgChatRoom } from "@elkdonis/services";
import { listManageContacts, listManageMembers } from "@/lib/manage";
import { listAllDirectory } from "@/lib/directory-admin";
import { getUpcomingEvents } from "@/lib/data";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Manage IFAC" };
export const dynamic = "force-dynamic";

/**
 * The console's front door: what state the site is in, and where to go.
 *
 * It answers the questions an admin actually arrives with — how many people are
 * on the page, how many are hidden, is the chat room set up — rather than
 * opening straight onto a JSON textarea, which is what /admin did.
 */
export default async function ManageOverviewPage() {
  const [members, contacts, roster, events, chatRoom] = await Promise.all([
    listManageMembers(),
    listManageContacts(),
    listAllDirectory(),
    getUpcomingEvents(20),
    getOrgChatRoom(siteConfig.orgId).catch(() => null),
  ]);

  const listed = roster.filter((r) => r.status === "published");
  const hidden = roster.length - listed.length;
  const unclaimed = roster.filter((r) => r.claimStatus !== "claimed").length;
  const rsvpTotal = events.reduce((total, e) => total + Number(e.rsvp_count || 0), 0);

  return (
    <>
      <div className="stats-grid" style={{ marginTop: 0 }}>
        <div className="stat-tile">
          <span>
            <strong>{listed.length}</strong> artists &amp; dealers on the site
            {hidden > 0 && <span className="small-note"> · {hidden} hidden</span>}
          </span>
        </div>
        <div className="stat-tile">
          <span>
            <strong>{members.length}</strong> people with IFAC accounts
          </span>
        </div>
        <div className="stat-tile">
          <span>
            <strong>{rsvpTotal}</strong> RSVPs across {events.length} events
          </span>
        </div>
      </div>

      <div className="admin-grid" style={{ marginTop: "1rem" }}>
        <section className="admin-panel">
          <h2>Where things are</h2>
          <ul className="small-note" style={{ paddingLeft: "1.1rem", lineHeight: 1.7 }}>
            <li>
              <Link href="/manage/directory">Artists &amp; dealers</Link> — the public
              roster. Add someone, edit their page, or take them off the site.
            </li>
            <li>
              <Link href="/manage/people">People &amp; access</Link> — who may do what
              inside IFAC, and who is a member at all.
            </li>
            <li>
              <Link href="/manage/sections">Site copy &amp; events</Link> — the words on
              the public pages, and the events the RSVP form hangs off.
            </li>
            <li>
              <Link href="/hub">The members&rsquo; hub</Link> — General Chat, the
              calendar, files, the pipeline board and the compose desk.
            </li>
          </ul>
          <p className="manage-note">
            A person&rsquo;s bio, photo, links and portfolio are edited on their own
            profile page, by them — this console controls whether they are published
            here and what they may do, not what their page says.
          </p>
        </section>

        <section className="admin-panel">
          <h2>Wants attention</h2>
          <ul className="small-note" style={{ paddingLeft: "1.1rem", lineHeight: 1.7 }}>
            <li>
              <strong>General Chat:</strong>{" "}
              {chatRoom ? (
                <>set up — {chatRoom.name}</>
              ) : (
                <>
                  not created yet. Open <Link href="/hub">the hub</Link> and press
                  &ldquo;Create the chat room&rdquo;.
                </>
              )}
            </li>
            <li>
              <strong>Unclaimed roster entries:</strong>{" "}
              {unclaimed === 0 ? (
                "none — everyone on the roster has an account."
              ) : (
                <>
                  {unclaimed} of {roster.length}. These are placeholders; match one to a
                  signed-up member on{" "}
                  <Link href="/manage/directory">Artists &amp; dealers</Link>.
                </>
              )}
            </li>
            <li>
              <strong>Hidden profiles:</strong>{" "}
              {hidden === 0 ? "none — every entry is on the site." : `${hidden} not shown publicly.`}
            </li>
            <li>
              <strong>Contacts &amp; sign-ups:</strong> {contacts.length} on{" "}
              <Link href="/manage/people">People &amp; access</Link>.
            </li>
          </ul>
          <p className="small-note">
            Network-wide accounts and the superadmin flag live in{" "}
            <a href={`${siteConfig.centralAdminUrl}/users`}>central admin</a>, not here.
          </p>
        </section>
      </div>
    </>
  );
}
