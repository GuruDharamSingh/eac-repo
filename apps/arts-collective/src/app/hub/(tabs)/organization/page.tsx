import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  getOrgIdentity,
  listOrgMembers,
  listUserMemberships,
  getThemeOverrides,
} from "@elkdonis/services";
import {
  getOrgAnnouncements,
  getOrgBySlug,
  getOrgFeed,
} from "@/lib/org";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { Button } from "@/components/ui/button";
import { PublishSection } from "@/components/hub/PublishSection";
import { SilexSurfaceControls } from "@/components/hub/SilexSurfaceControls";
import { MembersPanel } from "@/components/hub/MembersPanel";
import { CreateContentDialog } from "@/components/cms/create-content-dialog";
import { JoinTiers } from "@/components/hub/JoinTiers";
import { AppearancePanel } from "@/components/hub/AppearancePanel";
import { MyAppearancePanel } from "@/components/hub/MyAppearancePanel";
import { OrgSwitcher } from "@/components/hub/OrgSwitcher";
import { TierBadge } from "@/components/hub/TierBadge";
import { OrgIdentityPanel } from "@/components/hub/OrgIdentityPanel";
import { saveOrgIdentityAction } from "@/lib/org-identity-actions";
import { SITE_THEME_VARS, THEMEABLE_PAGES } from "@/lib/theme-tokens";
import { saveSiteThemeAction, saveMyThemeAction } from "@/lib/theme-actions";

/**
 * Reads the session cookie, so it can never be a static page. Declared
 * rather than left to Next's automatic bailout: without it the export
 * step tries to prerender the page and dies inside a client boundary.
 */
export const dynamic = "force-dynamic";

const EDITOR_ROLES = new Set(["owner", "guide"]);

const ROLE_LABEL: Record<string, string> = {
  owner: "owner",
  guide: "guide",
  member: "member",
  viewer: "viewer",
};

/**
 * The Organization tab is keyed on MEMBERSHIP, not editorship: a plain member
 * of amrit_canada who signs in here lands on Amrit Canada, not on the "start
 * an org" pitch. Owners and guides get the editing sections on top of that.
 *
 * Which org shows is `?org=<slug>` (the switcher writes it), defaulting to the
 * first org the person can edit, else the first they belong to. `?new=1`
 * surfaces the tier signup above the org — for someone who has an org and
 * wants to start another.
 */
export default async function OrganizationTabPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; new?: string }>;
}) {
  const { org: orgParam, new: newParam } = await searchParams;

  // Not requireUser: this tab is the network's front door for anyone who
  // doesn't have an org yet, so a signed-out visitor sees the join tiers
  // rather than being bounced to /login.
  const user = await getCurrentUser();
  if (!user) return <JoinTiers signedIn={false} />;

  const memberships = await listUserMemberships(user.id);
  if (memberships.length === 0) return <JoinTiers signedIn />;

  const startingNew = newParam === "1";
  const selected =
    memberships.find((m) => m.orgSlug === orgParam) ??
    memberships.find((m) => EDITOR_ROLES.has(m.role)) ??
    memberships[0];
  const canEdit = EDITOR_ROLES.has(selected.role);
  const owner = selected.role === "owner";

  const [org, homes, members, identity] = await Promise.all([
    getOrgBySlug(selected.orgSlug),
    orgHomeUrlMap(),
    listOrgMembers(selected.orgId),
    getOrgIdentity(selected.orgSlug),
  ]);
  const homeUrl = orgHomeUrl(homes, selected.orgSlug);
  const homeLabel = homeUrl.replace(/^https?:\/\//, "");
  const tier = org?.tier ?? "free";

  // Editor-only data: guide announcements and the site's own theme overrides,
  // each scope unmerged — the editor shows what a scope sets, not inherits.
  const announcements = canEdit ? await getOrgAnnouncements(selected.orgId, 5) : [];
  const overridesByPage: Record<string, Record<string, string>> = {};
  if (canEdit) {
    for (const page of THEMEABLE_PAGES) {
      overridesByPage[page.key] = await getThemeOverrides({
        orgId: selected.orgId,
        pageKey: page.key,
      });
    }
  }
  const myThemeOverrides = await getThemeOverrides({ userId: user.id });

  // Member-only data: what the org has published lately, linked to its home.
  const recent = canEdit ? [] : await getOrgFeed(selected.orgId, 6);

  const selfHref = `/hub/organization?org=${encodeURIComponent(selected.orgSlug)}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Organization Hub
            </p>
            <TierBadge tier={tier} />
            {memberships.length > 1 && (
              <OrgSwitcher
                current={selected.orgSlug}
                options={memberships.map((m) => ({
                  slug: m.orgSlug,
                  name: m.orgName,
                  role: ROLE_LABEL[m.role] ?? m.role,
                }))}
              />
            )}
          </div>
          <h1 className="font-serif text-4xl leading-tight text-foreground">
            {selected.orgName}
          </h1>
          <p className="text-sm text-muted-foreground">
            You are {ROLE_LABEL[selected.role] === "owner" ? "an" : "a"}{" "}
            {ROLE_LABEL[selected.role] ?? selected.role} here.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {canEdit ? "Your site" : "Site"}
          </span>
          <div className="flex items-center gap-3">
            <code className="rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-sm text-foreground">
              {homeLabel}
            </code>
            <Button asChild variant="outline" size="sm">
              <a href={homeUrl} target="_blank" rel="noopener">
                Open ↗
              </a>
            </Button>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={startingNew ? selfHref : `${selfHref}&new=1`}>
              {startingNew ? "Cancel" : "Start something new →"}
            </Link>
          </Button>
        </div>
        {owner && (
          <p className="mt-4 text-sm">
            <Link className="underline" href="/hub/agreements">
              Agreements &amp; revenue shares →
            </Link>
            <span className="ml-2 text-muted-foreground">
              What {selected.orgName} may take from a member&rsquo;s sale, and
              who has agreed to it.
            </span>
          </p>
        )}
      </header>

      {startingNew && (
        <section className="mb-12 rounded-lg border border-dashed border-border">
          <JoinTiers signedIn />
        </section>
      )}

      {canEdit ? (
        <>
          <section className="mb-10 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">Make something</h2>
              <span className="text-xs text-muted-foreground">
                Offerings, your site, and writing to your members
              </span>
            </div>
            <PublishSection
              orgSlug={selected.orgSlug}
              orgHomeUrl={homeUrl}
              // Owner/guide — the same bar canManageQuestionnaires applies
              // server-side, so the card list matches what the action allows.
              canManageOrg={canEdit}
            />
          </section>

          <section className="mb-10 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">
                Who this org is
              </h2>
              <span className="text-xs text-muted-foreground">
                Shown on your profile page and in the directory
              </span>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <OrgIdentityPanel
                orgId={selected.orgId}
                onSave={saveOrgIdentityAction}
                initial={{
                  displayName: identity?.orgName ?? selected.orgName,
                  headline: identity?.headline ?? "",
                  bio: identity?.bio ?? "",
                  avatarUrl: identity?.avatarUrl ?? "",
                  city: identity?.city ?? "",
                  region: identity?.region ?? "",
                  country: identity?.country ?? "",
                }}
              />
            </div>
          </section>

          <section className="mb-10 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">Members</h2>
              <span className="text-xs text-muted-foreground">
                {members.length} {members.length === 1 ? "member" : "members"}
              </span>
            </div>
            <MembersPanel
              orgSlug={selected.orgSlug}
              currentUserId={user.id}
              isOwner={owner}
              members={members.map((m) => ({
                userId: m.userId,
                email: m.email,
                displayName: m.displayName,
                role: m.role,
              }))}
            />
          </section>

          <section className="mb-10 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">
                Guide announcements
              </h2>
              <CreateContentDialog
                orgSlug={selected.orgSlug}
                defaultKind="post"
                defaultVisibility="ORGANIZATION"
                triggerLabel="Post an announcement →"
                triggerVariant="outline"
              />
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing posted yet. Announcements here are visible only to
                your org&apos;s owners and guides.
              </p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <h3 className="font-serif text-base leading-snug text-foreground">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {a.excerpt}
                      </p>
                    )}
                    {(a.published_at || a.created_at) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(
                          a.published_at ?? a.created_at
                        ).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mb-10 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">Appearance</h2>
              <span className="text-xs text-muted-foreground">
                Colours &amp; corners
              </span>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
                These set CSS variables the whole site reads — your pages and
                the live components share them, so a change here restyles
                both. Pick a scope to theme the whole site or just one page.
              </p>
              <div className="flex flex-wrap items-start gap-4">
                <AppearancePanel
                  orgId={selected.orgId}
                  vars={SITE_THEME_VARS}
                  pages={THEMEABLE_PAGES}
                  overridesByPage={overridesByPage}
                  onSave={saveSiteThemeAction}
                />
                <MyAppearancePanel
                  vars={SITE_THEME_VARS}
                  overrides={myThemeOverrides}
                  onSave={saveMyThemeAction}
                />
              </div>
            </div>
          </section>

          {/* This hub is ONE org's hub — the switcher above changes which.
              This section used to list every org the viewer could edit, which
              made the page read as a personal dashboard of all their orgs
              rather than the selected org's own home. */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">
                Your subdomain
              </h2>
              <span className="text-xs text-muted-foreground">
                Every org has one, whatever its tier
              </span>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-foreground">
                  {homeLabel}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Public surface:{" "}
                  {org?.layout_mode === "silex"
                    ? "your published Silex page"
                    : "the standard three pages"}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {[
                    ["Offering", "/offering"],
                    ["Profile", "/profile"],
                    ["Community", "/community"],
                  ].map(([label, path]) => (
                    <a
                      key={path}
                      href={`${homeUrl}${path}`}
                      target="_blank"
                      rel="noopener"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      {label} ↗
                    </a>
                  ))}
                </p>
                {!org?.nextcloud_folder_path && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nextcloud project folder will be created on first launch.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button asChild variant="outline" size="sm">
                  <a href={homeUrl} target="_blank" rel="noopener">
                    Open ↗
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/hub/workshops/${selected.orgSlug}`}>Workshops</Link>
                </Button>
                <SilexSurfaceControls
                  slug={selected.orgSlug}
                  layoutMode={org?.layout_mode ?? "default"}
                  hasPublished={Boolean(org?.silex_published_path)}
                />
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="mb-10 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">
                Recently from {selected.orgName}
              </h2>
              <a
                href={homeUrl}
                target="_blank"
                rel="noopener"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Everything on the site →
              </a>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing published yet.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recent.map((item) => (
                  <a
                    key={item.id}
                    href={`${homeUrl}/${item.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 transition hover:border-primary/60"
                  >
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {item.kind}
                    </span>
                    <span className="font-serif text-base leading-snug text-foreground">
                      {item.title}
                    </span>
                    {item.excerpt && (
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {item.excerpt}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="mb-10 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">Members</h2>
              <span className="text-xs text-muted-foreground">
                {members.length} {members.length === 1 ? "member" : "members"}
              </span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <span className="truncate text-sm text-foreground">
                    {m.displayName ?? m.email}
                    {m.userId === user.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-foreground">Appearance</h2>
              <span className="text-xs text-muted-foreground">Your pages</span>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
                Owners and guides set the site&rsquo;s look. These colours are
                yours — they apply to your own profile pages across the network.
              </p>
              <MyAppearancePanel
                vars={SITE_THEME_VARS}
                overrides={myThemeOverrides}
                onSave={saveMyThemeAction}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
