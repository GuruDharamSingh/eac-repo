import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { hasOrgRole } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getSiteContent } from "@/lib/data";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { HubCard } from "@/components/hub/HubCard";
import { HubDrawer } from "@/components/hub/HubDrawer";
import { AppearanceCard } from "@/components/hub/AppearanceCard";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getThemeOverrides } from "@elkdonis/services";
import { IFAC_THEME_VARS, IFAC_THEMEABLE_PAGES } from "@/lib/theme-tokens";
import { saveIfacThemeAction } from "@/lib/theme-actions";

/**
 * The IFAC members' hub — appearance pass.
 *
 * Every tile opens a modal describing what it will do; none of them are wired
 * to their feature yet. That is deliberate for this pass: the layout and the
 * interaction model are the thing being decided, and stubbing the panels keeps
 * the shape reviewable without committing to eight half-built features.
 *
 * Access is members-and-up in the ifac org. Note the org currently has NO
 * members — its 18 directory profiles are unclaimed sentinel records — so in
 * practice this redirects everyone until the claim flow lands.
 */
export const dynamic = "force-dynamic";

export default async function HubPage() {
  const session = await getServerSession();
  if (!session.user) redirect("/login?redirect=/hub");

  const userId = session.user.db_user_id ?? session.user.id;
  const isMember = await hasOrgRole(userId, siteConfig.orgId, [
    "owner",
    "guide",
    "member",
  ]);
  if (!isMember) redirect("/?notice=members-only");

  const isAdmin = await hasOrgRole(userId, siteConfig.orgId, ["owner", "guide"]);
  const content = await getSiteContent();
  const displayName = session.user.email.split("@")[0];

  // Each scope's own overrides, unmerged — the editor shows what a scope sets,
  // not what it inherits.
  const overridesByPage: Record<string, Record<string, string>> = {};
  for (const page of IFAC_THEMEABLE_PAGES) {
    overridesByPage[page.key] = await getThemeOverrides({
      orgId: siteConfig.orgId,
      pageKey: page.key,
    });
  }

  return (
    <div className="site-shell">
      {/* Site defaults, then this page's overrides, then the viewer's own. */}
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={userId} />
      <SiteHeader />

      <main className="hub">
        <section className="hero image-only hub-hero" aria-label="IFAC banner">
          <img src={content.hero.imageUrl} alt="IFAC banner" />
        </section>

        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName}</p>
            <h1>Welcome IFAC Members to the Main Hub</h1>
            <p className="hub-welcome-sub">
              Post to the group, manage your profile and files, and help shape
              what the collective works on next.
            </p>
          </div>
          <HubDrawer displayName={displayName} profileHref={null} />
        </div>

        {/* Announcements — full width, above the grid */}
        <section className="hub-announcements" aria-labelledby="ann-head">
          <div className="hub-panel-head">
            <h2 id="ann-head">Announcements</h2>
            <span className="hub-tag">IFAC General</span>
          </div>
          <div className="hub-talk-frame">
            <p className="hub-empty">
              The IFAC General talk room has not been provisioned yet, so there
              is nothing to embed. Once the group has a Talk room this becomes
              the live chat and announcements feed.
            </p>
          </div>
        </section>

        {/* Two columns of square tiles */}
        <div className="hub-grid">
          <div className="hub-col">
            <HubCard
              title="My profile"
              blurb="Your bio, portrait, links and gallery."
              glyph="✦"
              accent="ink"
            >
              <StubPanel
                what="Edit your public IFAC profile"
                items={[
                  "Bio, portrait, pronouns and location",
                  "External links and portfolio URL",
                  "Your artwork gallery",
                ]}
                note="Reads users + org_profiles, so edits here follow you across the network while IFAC keeps its own role title for you."
              />
            </HubCard>

            <HubCard
              title="Create a document"
              blurb="A collaborative doc in the group's storage."
              glyph="✎"
              accent="blue"
            >
              <StubPanel
                what="Start a collaborative document"
                items={[
                  "Opens in Nextcloud Office",
                  "Saved to the IFAC group folder",
                  "Shared with members by default",
                ]}
              />
            </HubCard>

            <HubCard
              title="Pipeline"
              blurb="Board of what the group is working on."
              glyph="▤"
              accent="moss"
              href="/hub/calendar"
            />

            <HubCard
              title="Weekly meeting"
              blurb="Standing time, agenda and join link."
              glyph="◷"
              accent="gold"
            >
              <StubPanel
                what="The group's standing weekly meeting"
                items={[
                  "Next occurrence and join link",
                  "Running agenda members can add to",
                  "Notes from the last session",
                ]}
              />
            </HubCard>
          </div>

          <div className="hub-col">
            <HubCard
              title="Compose"
              blurb="Art, announcements, events and products."
              glyph="✚"
              accent="oxide"
            >
              <StubPanel
                what="Add something to IFAC or your own page"
                items={[
                  "Upload new art — adds to your gallery",
                  "Announcement — post to the hub feed or your profile",
                  "Event — publishes and syncs to the group calendar",
                  "Product — a listing for sale",
                ]}
                note="This is the shared CMS the other apps use, so a post here is the same kind of thread inner-gathering creates."
              />
            </HubCard>

            <HubCard
              title="Files"
              blurb="Browse the group's Nextcloud storage."
              glyph="▦"
              accent="ink"
            >
              <StubPanel
                what="The IFAC shared drive"
                items={[
                  "Browse and preview group files",
                  "Upload into the folder you're looking at",
                  "Pull an existing file into a post",
                ]}
              />
            </HubCard>

            {isAdmin && (
              <HubCard
                title="Manage site"
                blurb="Review people and promote members."
                glyph="◈"
                accent="charcoal"
              >
                <StubPanel
                  what="Who is in IFAC, and who could be"
                  items={[
                    "Review current directory entries and accounts",
                    "Create a profile page for someone new",
                    "Promote a person to member, guide or owner",
                  ]}
                  note="18 directory profiles are currently unclaimed — records without accounts. Promoting starts with them claiming."
                />
              </HubCard>
            )}

            <HubCard
              title="Suggested ideas"
              blurb="Propose something, or read the queue."
              glyph="☉"
              accent="moss"
            >
              <StubPanel
                what="Ideas from the membership"
                items={[
                  "Submit an idea for the group to consider",
                  "Read and respond to what others proposed",
                  "See what has been picked up",
                ]}
              />
            </HubCard>
          </div>
        </div>

        {/* Full width */}
        <section id="questionnaires" className="hub-wide">
          <HubCard
            title="Questionnaires & group research"
            blurb="Ask the membership something, and read the results."
            glyph="◎"
            accent="blue"
            wide
          >
            <StubPanel
              what="Pose a questionnaire or poll to IFAC"
              items={[
                "Build questions — choice, text, number or image",
                "Choose who sees the results: admins, or all members",
                "Open it, then close it when you have enough",
              ]}
              note="The schema and service for this exist; results are never public by design."
            />
          </HubCard>
        </section>

        {isAdmin && (
        <section className="hub-wide">
          <AppearanceCard
            vars={IFAC_THEME_VARS}
            pages={IFAC_THEMEABLE_PAGES}
            overridesByPage={overridesByPage}
            onSaveSite={saveIfacThemeAction}
          />
        </section>
        )}

        <section className="hub-wide">
          <HubCard
            title="Help & notes from the developer"
            blurb="How things work, and how to tell us they don't."
            glyph="?"
            accent="gold"
            wide
          >
            <StubPanel
              what="Getting around"
              items={[
                "Navigating Nextcloud and the group folders",
                "Editing your profile and gallery",
                "What's new, and what's still being built",
              ]}
              note="A comment box goes here so members can leave notes for the developer, with replies threaded underneath."
            />
          </HubCard>
        </section>
      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}

/**
 * Placeholder body for a tile whose feature is not built yet. Says plainly
 * what it will do rather than showing a dead form — a stub that looks
 * functional is worse than one that admits it isn't.
 */
function StubPanel({
  what,
  items,
  note,
}: {
  what: string;
  items: string[];
  note?: string;
}) {
  return (
    <div className="hub-stub">
      <p className="hub-stub-what">{what}</p>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {note && <p className="hub-stub-note">{note}</p>}
      <p className="hub-stub-flag">Not wired up yet — layout review only.</p>
    </div>
  );
}
