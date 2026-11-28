import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { guardOrgEmail, loadEmailSuite, emailRoutesFor } from "@/lib/email-suite";
import {
  getOrgIdentity,
  listOrgMembers,
  listUserMemberships,
  getThemeOverrides,
  listOrgFeeds,
  listOrgEventsInRange,
  listListingRequests,
} from "@elkdonis/services";
import { getOrgBySlug, getOrgFeed, getOfferingThread } from "@/lib/org";
import { hasOrgHome } from "@/lib/puck/store";
import { removeOrgHomeAction } from "@/lib/puck/actions";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { EMPTY_CONSOLE_STATE, getConsoleState, paymentsConfigured } from "@/lib/org-console";
import { loadOrgForumFace } from "@/lib/hub-forum";
import { loadContentCard } from "@/lib/content-card";
import { Button } from "@/components/ui/button";
import { ConsoleFaces } from "@/components/hub/console/ConsoleFaces";
import { OrgForumFace } from "@/components/hub/console/OrgForumFace";
import { ContentCardFace } from "@/components/hub/console/ContentCardFace";
import { JoinTiers } from "@/components/hub/JoinTiers";
import { MyAppearancePanel } from "@/components/hub/MyAppearancePanel";
import { ListingRequestsPanel } from "./ListingRequestsPanel";
import { TierBadge } from "@/components/hub/TierBadge";
import { saveOrgIdentityAction } from "@/lib/org-identity-actions";
import { SITE_THEME_VARS, THEMEABLE_PAGES } from "@/lib/theme-tokens";
import { saveSiteThemeAction, saveMyThemeAction } from "@/lib/theme-actions";
import { OrgConsoleHost } from "@/components/hub/console/OrgConsoleHost";
import { OrgSwitch } from "@/components/hub/console/OrgSwitch";
import { ConnectionsBand } from "@/components/hub/console/ConnectionsBand";
import { SettingsButton } from "@/components/hub/console/SettingsButton";
import { WordArtCard } from "@/components/hub/WordArtCard";
import { loadCurrentWork } from "@/lib/offer-card";
import { drawsInsteadOf } from "@/lib/offer-card-words";
import type { ConsoleSettingsProps } from "@/components/hub/console/ConsoleSettings";

/**
 * Reads the session cookie, so it can never be a static page. Declared
 * rather than left to Next's automatic bailout: without it the export
 * step tries to prerender the page and dies inside a client boundary.
 */
export const dynamic = "force-dynamic";

const EDITOR_ROLES = new Set(["owner", "guide"]);

/**
 * The Organization tab — one org's console.
 *
 * Keyed on MEMBERSHIP, not editorship: a plain member of amrit_canada who
 * signs in here lands on Amrit Canada, not on the "start an org" pitch. Owners
 * and guides get the console on top of that.
 *
 * Always a card grid (2026-11-27): editors get the managing cards, members and
 * followers the reading ones; the org is chosen from a drop down; the old
 * "what needs you" row is the "Your pieces" card. Dark scope: org-dark.css.
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

  // The calendar face draws this month and the next, so the surface it opens
  // has something to show before `listEvents` pages anywhere else.
  const monthFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthTo = new Date(monthFrom.getFullYear(), monthFrom.getMonth() + 2, 1);

  const [org, homes, members, identity, consoleState, feeds, events, forum] =
    await Promise.all([
      getOrgBySlug(selected.orgSlug),
      orgHomeUrlMap(),
      listOrgMembers(selected.orgId),
      getOrgIdentity(selected.orgSlug),
      getConsoleState(selected.orgId),
      listOrgFeeds(selected.orgId),
      listOrgEventsInRange(selected.orgId, monthFrom, monthTo, 200, { userId: user.id, canEdit }),
      // The forum of the SELECTED org, for its card. The wider "across your organisations"
      // list is a layer the card opens (ForumAcross), no longer a board at the foot.
      loadOrgForumFace({ id: selected.orgId, slug: selected.orgSlug, name: selected.orgName }),
    ]);
  const homeUrl = orgHomeUrl(homes, selected.orgSlug);
  const homeLabel = homeUrl.replace(/^https?:\/\//, "");
  // The content library card, for every role (the routes decide what each may see). Replaces the file browser.
  const content = await loadContentCard({
    userId: user.id,
    orgId: selected.orgId,
    orgSlug: selected.orgSlug,
    orgName: selected.orgName,
    role: selected.role,
    siteUrl: homeUrl,
  });
  // "Open site" only where the address works: a verified own domain, or the
  // collective itself. *.arts-collective.com resolves but has no certificate
  // in production (checked 2026-09-18), so a subdomain link is an error page.
  const siteLive = Boolean(identity?.primaryDomain) || selected.orgSlug === "arts-collective";
  const ARTDIRECT = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
  // Members show by default; these hid themselves and asked back (migration 149).
  const listingRequests = canEdit ? await listListingRequests(selected.orgId).catch(() => []) : [];
  const tier = org?.tier ?? "free";

  // Editor-only: the site's own theme overrides, each scope unmerged — the
  // editor shows what a scope sets, not what it inherits.
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

  // Member-only: what the org has published lately, linked to its home.
  const recent = canEdit ? [] : await getOrgFeed(selected.orgId, 6);

  // Editor-only: what the subdomain root shows today (Settings → Site & address).
  const [designed, offering] = canEdit
    ? await Promise.all([hasOrgHome(selected.orgId), getOfferingThread(selected.orgId)])
    : [false, null];
  const leading: ConsoleSettingsProps["leading"] =
    org?.layout_mode === "silex" && org.silex_published_path
      ? { mode: "silex" }
      : designed
        ? { mode: "designed" }
        : offering
          ? { mode: offering.pinned ? "pinned" : "latest", title: offering.title }
          : { mode: "default" };

  // The email face draws real correspondence, so it needs the suite's data —
  // and only editors get it, because the face's own controls send in the org's
  // name. A member sees no tile rather than a tile that refuses them.
  const emailGuard = canEdit ? await guardOrgEmail(selected.orgSlug) : null;
  const emailSuite = emailGuard
    ? await loadEmailSuite(emailGuard, emailRoutesFor(emailGuard.orgSlug))
    : null;

  // The Current Work Page card: what leads the page, its template and look. Editors only.
  const currentWork = canEdit
    ? await loadCurrentWork(
        { id: selected.orgId, slug: selected.orgSlug, name: selected.orgName },
        homeUrl,
        drawsInsteadOf({
          silex: org?.layout_mode === "silex" && Boolean(org.silex_published_path),
          designed,
          offering: offering ? { pinned: Boolean(offering.pinned), title: offering.title } : null,
        })
      ).catch((err) => {
        console.error("[organization] current work card:", err);
        return null;
      })
    : null;

  const selfHref = `/hub/organization?org=${encodeURIComponent(selected.orgSlug)}`;

  const settings: ConsoleSettingsProps | null = canEdit
    ? {
        orgId: selected.orgId,
        orgSlug: selected.orgSlug,
        orgName: selected.orgName,
        isOwner: owner,
        currentUserId: user.id,
        homeUrl,
        layoutMode: org?.layout_mode === "silex" ? "silex" : "default",
        hasPublishedSilex: Boolean(org?.silex_published_path),
        designHref: `/hub/sites/${encodeURIComponent(selected.orgSlug)}/design`,
        hasDesignedPage: designed,
        leading,
        onRemoveDesign: removeOrgHomeAction,
        identity: {
          displayName: identity?.orgName ?? selected.orgName,
          headline: identity?.headline ?? "",
          bio: identity?.bio ?? "",
          avatarUrl: identity?.avatarUrl ?? "",
          city: identity?.city ?? "",
          region: identity?.region ?? "",
          country: identity?.country ?? "",
        },
        onSaveIdentity: saveOrgIdentityAction,
        themeVars: SITE_THEME_VARS,
        themePages: THEMEABLE_PAGES,
        overridesByPage,
        onSaveSiteTheme: saveSiteThemeAction,
        myThemeOverrides,
        onSaveMyTheme: saveMyThemeAction,
        members: members.map((m) => ({
          userId: m.userId,
          email: m.email,
          displayName: m.displayName,
          role: m.role,
        })),
      }
    : null;

  return (
    <OrgConsoleHost
      state={canEdit ? consoleState : EMPTY_CONSOLE_STATE}
      orgId={selected.orgId}
      orgSlug={selected.orgSlug}
      orgName={selected.orgName}
      orgHomeUrl={homeUrl}
      displayName={user.email}
      canEdit={canEdit}
      feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))}
      settings={settings}
      email={emailSuite}
      hasDesignedPage={designed}
      currentWork={currentWork}
      content={content}
    >
      <div className="orgp-body">
        <header className="orgp-head">
          <div className="orgp-head-main">
            <p className="orgp-kicker">
              Organization
              <TierBadge tier={tier} />
            </p>
            {/* Which of your organisations the page shows: a drop down, not a row of cards. */}
            <OrgSwitch
              orgs={memberships.map((m) => ({ slug: m.orgSlug, name: m.orgName, role: m.role }))}
              current={selected.orgSlug}
            />
            <p className="orgp-sub">
              <code>{homeLabel}</code>
            </p>
          </div>

          <div className="orgp-actions">
            {canEdit && <SettingsButton />}
            {siteLive && (
              <Button asChild variant="outline" size="sm">
                <a href={homeUrl} target="_blank" rel="noopener">
                  Open site ↗
                </a>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href={startingNew ? selfHref : `${selfHref}&new=1`}>
                {startingNew ? "Cancel" : "Start something new"}
              </Link>
            </Button>
          </div>
        </header>

        {startingNew && (
          <section className="mb-10 rounded-lg border border-dashed border-border">
            <JoinTiers signedIn />
          </section>
        )}

        {listingRequests.length > 0 && (
          <div className="mb-8">
            <ListingRequestsPanel
              orgId={selected.orgId}
              orgName={selected.orgName}
              requests={listingRequests.map((r) => ({
                id: r.id,
                displayName: r.displayName,
                avatarUrl: r.avatarUrl,
                createdAt: r.createdAt,
                href: r.slug && ARTDIRECT ? `${ARTDIRECT}/${r.slug}` : null,
              }))}
            />
          </div>
        )}

        {/* ALWAYS cards. Editors get the managing ones, members and followers the reading ones. */}
        <ConsoleFaces
          events={events}
          canEdit={canEdit}
          owner={owner}
          email={emailSuite}
          currentWork={currentWork}
          state={canEdit ? consoleState : null}
          recent={recent.map((r) => ({ id: r.id, slug: r.slug, kind: r.kind, title: r.title }))}
          orgName={selected.orgName}
          orgSlug={selected.orgSlug}
          orgHomeUrl={homeUrl}
          contentSlot={<ContentCardFace data={content} />}
          forumSlot={<OrgForumFace forum={forum} />}
        />

        <div className="orgp-block">
          <WordArtCard orgId={selected.orgId} />
        </div>

        {canEdit && (
          <ConnectionsBand
            state={consoleState}
            orgId={selected.orgId}
            orgSlug={selected.orgSlug}
            paymentsReady={paymentsConfigured()}
            files={false}
          />
        )}

        {!canEdit && (
          <section className="orgp-block orgp-rule space-y-3">
            <h2 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Your appearance
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Owners and guides set the site&rsquo;s look. These colours are
              yours — they apply to your own profile pages across the network.
            </p>
            <MyAppearancePanel
              vars={SITE_THEME_VARS}
              overrides={myThemeOverrides}
              onSave={saveMyThemeAction}
            />
          </section>
        )}

      </div>
    </OrgConsoleHost>
  );
}
