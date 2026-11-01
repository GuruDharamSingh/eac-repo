import "../hub-site.css";
import "../hub-cards.css";
import type { Metadata } from "next";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { getProfileSummary } from "@/lib/hub-data";
import { readProfileSections } from "@/lib/profile-sections";
import { HubPageShell } from "@/components/hub/HubPageShell";
import { PageSectionSwitches } from "@/components/hub/site/PageSectionSwitches";

export const metadata: Metadata = { title: "My profile · IFAC Hub" };
export const dynamic = "force-dynamic";

/**
 * My profile, as a page (2026-10-10). Where the "Page sections" card went:
 * the developer asked for it to be part of the profile rather than a card of
 * its own. The identity itself (name, portrait, bio, payouts, "Where you
 * show") stays in the shared profile popup, opened here by `?surface=`
 * (the provider in the hub layout reads it); this page adds what only IFAC
 * has — the sections of the member's public page, gallery counts and the
 * store — with the same switches as the Page layout (`PageSectionSwitches`,
 * PATCH /api/hub/profile-sections).
 */
export default async function HubProfilePage() {
  const viewer = await requireOrgMember("/hub/profile");
  const [profile, sections] = await Promise.all([
    getProfileSummary(viewer.userId).catch(() => null),
    readProfileSections(viewer.userId),
  ]);

  const name = profile?.displayName?.trim() || viewer.email.split("@")[0];
  const profileHref = profile?.slug
    ? `/${profile.kind === "dealer" ? "dealers" : "artists"}/${profile.slug}`
    : null;

  return (
    <HubPageShell
      userId={viewer.userId}
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "My profile" }]}
      title="My profile"
      intro={<p>How you appear to the rest of the collective, and what your page on {siteConfig.domain} shows.</p>}
    >
      <section className="eac-hp-panel ifac-me" aria-labelledby="me-name">
        <div className="ifac-me__id">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ifac-me__avatar" src={profile.avatarUrl} alt="" />
          ) : (
            <span className="ifac-me__avatar is-empty" aria-hidden>
              {name.charAt(0).toUpperCase() || "·"}
            </span>
          )}
          <div>
            <h2 id="me-name">{name}</h2>
            {profile?.roleTitle || profile?.headline ? <p>{profile.roleTitle ?? profile.headline}</p> : null}
          </div>
        </div>
        <div className="eac-nc-actions">
          <a className="eac-nc-btn eac-nc-btn--primary" href="/hub/profile?surface=profile:edit">
            Edit your profile
          </a>
          <a className="eac-nc-btn" href="/hub/profile?surface=profile:show">
            Where you show
          </a>
          <a className="eac-nc-btn" href="/hub/profile?surface=profile:payouts">
            Payouts
          </a>
        </div>
      </section>

      {profile ? (
        <section className="eac-hp-section" aria-label="Page sections">
          <PageSectionSwitches
            sections={sections}
            profileHref={profileHref}
            marketplaceUrl={siteConfig.marketplaceUrl}
          />
          <dl className="ifac-me__facts">
            <dt>Featured work</dt>
            <dd>
              {profile.galleryCount
                ? `${profile.galleryCount} piece${profile.galleryCount === 1 ? "" : "s"}`
                : "None yet"}
            </dd>
            <dt>Galleries</dt>
            <dd>
              {profile.galleriesCount
                ? `${profile.galleriesCount} page${profile.galleriesCount === 1 ? "" : "s"}`
                : "None yet — start one from your page"}
            </dd>
          </dl>
          {profileHref ? (
            <div className="eac-nc-actions">
              <a className="eac-nc-btn" href={`${profileHref}?edit=1`}>
                Edit my page
              </a>
              <a className="eac-nc-btn" href={profileHref}>
                View my page
              </a>
            </div>
          ) : (
            <p className="ifac-me__note">
              Your profile has no address yet, so your page cannot be opened. An owner or guide can set one.
            </p>
          )}
        </section>
      ) : (
        <section className="eac-hp-panel">
          <p>
            There is no profile record for your account yet. An owner or guide can create one, or claim an
            existing directory entry for you.
          </p>
        </section>
      )}
    </HubPageShell>
  );
}
