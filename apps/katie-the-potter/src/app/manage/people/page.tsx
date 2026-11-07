import type { Metadata } from "next";
import { isAdmin } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";
import { loadManageCtx } from "@/lib/manage";
import { activeClaimLink, CLAIM_TTL_DAYS, listOrgPeople } from "@/lib/manage-claim";
import { HandOver } from "@/components/manage/hand-over";
import { EmptyState, PageHeader } from "@elkdonis/cms-ui/manage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "People" };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", guide: "Editor", member: "Member", viewer: "Follower" };

/** Who has a role on this site, and the hand-over link that gives the shop to its real owner. */
export default async function ManagePeople() {
  const { viewer, store } = await loadManageCtx("/manage/people");
  const mayHandOver = viewer.role === "owner" || (await isAdmin(viewer.userId).catch(() => false));
  const [people, active] = await Promise.all([listOrgPeople(siteConfig.orgId), mayHandOver ? activeClaimLink(siteConfig.orgId) : Promise.resolve(null)]);

  return (
    <>
      <PageHeader title="People" description="Who has a role on this site. Roles here are separate from the network account, which works everywhere." />

      {mayHandOver ? (
        <section className="ktp-m-card">
          <h2>Hand the shop to its owner</h2>
          <p>
            Create a one-time link and send it to the person the shop is for. They open it, sign in or create an account, and confirm. They then own this
            site{store ? " and its store on Collect Art, with every piece credited to them" : ""}. The account it was set up on stays, as a follower.
          </p>
          <p className="ktp-m-fine">
            The link works once and expires after {CLAIM_TTL_DAYS} days. Only a fingerprint of it is kept, so it is shown once: copy it when you create it.
          </p>
          {active ? (
            <p className="ktp-m-status" data-tone="warn">
              A link is open until {new Date(active.expiresAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" })}
              {active.createdByEmail ? `, created by ${active.createdByEmail}` : ""}.
            </p>
          ) : null}
          <HandOver hasActive={Boolean(active)} />
        </section>
      ) : null}

      {people.length === 0 ? (
        <EmptyState title="Nobody yet" body="People who sign up here join as followers." />
      ) : (
        <ul className="ktp-m-list" aria-label="People">
          {people.map((p) => (
            <li key={p.userId} className="ktp-m-person">
              <span className="ktp-acct__dot" aria-hidden="true">
                {(p.name ?? p.email ?? "?").charAt(0).toUpperCase()}
              </span>
              <span className="ktp-m-person-main">
                <b>{p.name ?? p.email ?? "Unknown"}</b>
                {p.email && p.name ? <span className="ktp-m-fine">{p.email}</span> : null}
              </span>
              <span className="ktp-m-badge" data-tone={p.role === "owner" ? "available" : undefined}>
                {ROLE_LABEL[p.role] ?? p.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
