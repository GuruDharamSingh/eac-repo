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
import { getOrgBySlug, getOrgFeed } from "@/lib/org";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { getConsoleState, paymentsConfigured } from "@/lib/org-console";
import { getCrossOrgForum } from "@/lib/org-forum";
import { Button } from "@/components/ui/button";
import { ConsoleFaces } from "@/components/hub/console/ConsoleFaces";
import { CrossOrgForum } from "@/components/hub/console/CrossOrgForum";
import { JoinTiers } from "@/components/hub/JoinTiers";
import { MyAppearancePanel } from "@/components/hub/MyAppearancePanel";
import { OrgStrip, type OrgStripItem } from "@elkdonis/cms-ui/center";
import { ListingRequestsPanel } from "./ListingRequestsPanel";
import { TierBadge } from "@/components/hub/TierBadge";
import { saveOrgIdentityAction } from "@/lib/org-identity-actions";
import { SITE_THEME_VARS, THEMEABLE_PAGES } from "@/lib/theme-tokens";
import { saveSiteThemeAction, saveMyThemeAction } from "@/lib/theme-actions";
import { OrgConsoleHost } from "@/components/hub/console/OrgConsoleHost";
import { AttentionBands } from "@/components/hub/console/AttentionBands";
import { ConnectionsBand } from "@/components/hub/console/ConnectionsBand";
import { SettingsButton } from "@/components/hub/console/SettingsButton";
import type { ConsoleSettingsProps } from "@/components/hub/console/ConsoleSettings";

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
 * The Organization tab — one org's console.
 *
 * Keyed on MEMBERSHIP, not editorship: a plain member of amrit_canada who
 * signs in here lands on Amrit Canada, not on the "start an org" pitch. Owners
 * and guides get the console on top of that.
 *
 * The shape is: what needs you → what you can make → what you're plugged into,
 * with everything configural behind one Settings surface. It used to be seven
 * sections of identical weight with no state in any of them, which meant an
 * owner could not tell what had changed since their last visit — the one
 * question a console exists to answer.
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
      listOrgEventsInRange(selected.orgId, monthFrom, monthTo),
      // Every org this person belongs to, not just the selected one — see
      // CrossOrgForum for why the board is deliberately the wider scope.
      getCrossOrgForum(memberships.map((m) => m.orgId)),
    ]);
  const homeUrl = orgHomeUrl(homes, selected.orgSlug);
  const homeLabel = homeUrl.replace(/^https?:\/\//, "");
  // "Open site" only where the address works: a verified own domain, or the
  // collective itself. *.arts-collective.com resolves but has no certificate
  // in production (checked 2026-09-18), so a subdomain link is an error page.
  const siteLive = Boolean(identity?.primaryDomain) || selected.orgSlug === "elkdonis";
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

  // The email face draws real correspondence, so it needs the suite's data —
  // and only editors get it, because the face's own controls send in the org's
  // name. A member sees no tile rather than a tile that refuses them.
  const emailGuard = canEdit ? await guardOrgEmail(selected.orgSlug) : null;
  const emailSuite = emailGuard
    ? await loadEmailSuite(emailGuard, emailRoutesFor(emailGuard.orgSlug))
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
      state={consoleState}
      orgId={selected.orgId}
      orgSlug={selected.orgSlug}
      orgName={selected.orgName}
      orgHomeUrl={homeUrl}
      displayName={user.email}
      canEdit={canEdit}
      feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))}
      settings={settings}
      email={emailSuite}
    >
      <div className="w-full py-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Organization
              </p>
              <TierBadge tier={tier} />
            </div>
            <h1 className="font-serif text-4xl leading-tight text-foreground">
              {selected.orgName}
            </h1>
            <p className="text-sm text-muted-foreground">
              You are {ROLE_LABEL[selected.role] === "owner" ? "an" : "a"}{" "}
              {ROLE_LABEL[selected.role] ?? selected.role} here ·{" "}
              <code className="font-mono">{homeLabel}</code>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

        {/* Which of your orgs this console is showing. The same strip /center
            uses for "Where you are", so the two places a person meets their
            list of organisations look like one thing. Past two it slides. */}
        {memberships.length > 1 && (
          <section className="mb-8" aria-label="Your organizations">
            <p className="eac-face-kicker mb-2">Your organizations</p>
            <OrgStrip
              orgs={memberships.map<OrgStripItem>((m) => ({
                orgId: m.orgId,
                orgSlug: m.orgSlug,
                orgName: m.orgName,
                role: m.role,
                isCurrent: m.orgSlug === selected.orgSlug,
                href:
                  m.orgSlug === selected.orgSlug
                    ? null
                    : `/hub/organization?org=${encodeURIComponent(m.orgSlug)}`,
                note: m.orgSlug === selected.orgSlug ? "showing" : "switch →",
              }))}
            />
          </section>
        )}

        {startingNew && (
          <section className="mb-10 rounded-lg border border-dashed border-border">
            <JoinTiers signedIn />
          </section>
        )}

        {canEdit ? (
          <>
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

            <AttentionBands state={consoleState} orgHomeUrl={homeUrl} />

            <ConsoleFaces events={events} canEdit={canEdit} email={emailSuite} />

            <ConnectionsBand
              state={consoleState}
              orgId={selected.orgId}
              orgSlug={selected.orgSlug}
              paymentsReady={paymentsConfigured()}
            />

            {owner && (
              <section className="space-y-2 border-t border-border pt-6 text-sm">
                <h2 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Owner
                </h2>
                <p>
                  <Link className="underline underline-offset-4" href="/hub/agreements">
                    Agreements &amp; revenue shares →
                  </Link>
                  <span className="ml-2 text-muted-foreground">
                    What {selected.orgName} may take from a member&rsquo;s sale,
                    and who has agreed to it.
                  </span>
                </p>
                <p>
                  <Link className="underline underline-offset-4" href="/hub/quotes">
                    Quotes on the center →
                  </Link>
                  <span className="ml-2 text-muted-foreground">
                    The line that turns over on {selected.orgName}&rsquo;s
                    center, and what members have sent in.
                  </span>
                </p>
              </section>
            )}
          </>
        ) : (
          <>
            {/* A member's console answers a different question: not "what
                needs me" — nothing here does — but "what is on, and where are
                my files". */}
            <section className="mb-10 space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
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

            <ConnectionsBand
              state={consoleState}
              orgId={selected.orgId}
              orgSlug={selected.orgSlug}
              paymentsReady={paymentsConfigured()}
            />

            <section className="space-y-3 border-t border-border pt-6">
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
          </>
        )}

        {/* Outside the editor/member split on purpose: the board is the same
            question for both — what has happened anywhere you belong. */}
        <CrossOrgForum
          items={forum}
          orgHomeUrls={Object.fromEntries(
            memberships.map((m) => [m.orgSlug, orgHomeUrl(homes, m.orgSlug)])
          )}
          orgCount={memberships.length}
        />
      </div>
    </OrgConsoleHost>
  );
}
