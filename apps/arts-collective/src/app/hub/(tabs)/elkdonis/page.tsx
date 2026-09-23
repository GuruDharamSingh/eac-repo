import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  getProfileForUser,
  isProfileComplete,
  isProfileInProgress,
  isBusinessComplete,
  isBusinessInProgress,
} from "@/lib/profile";
import { getNetworkCounts } from "@/lib/network";
import { getEditableOrgsForUser } from "@/lib/org";
import { getArcadeArtwork } from "@/lib/arcade";
import {
  ELKDONIS_FEEDS,
  forumBase,
  sophiaLive,
  forumHref,
  forumViewerFor,
  getCrossPostCandidates,
  getElkdonisTopics,
  getViewerCard,
} from "@/lib/elkdonis-hub";
import { YourSubmissions } from "@/components/hub/YourSubmissions";
import { ComposeForm } from "@/components/hub/elkdonis/ComposeForm";
import { Arcade } from "@/components/hub/elkdonis/Arcade";
import { CrossPostSlider, type PromoSlide } from "@/components/hub/elkdonis/CrossPostSlider";
import { WizardRail, type WizardCard } from "@/components/hub/elkdonis/WizardRail";
import "./elkdonis-hub.css";

/**
 * Reads the session cookie, so it can never be a static page. Declared
 * rather than left to Next's automatic bailout: without it the export
 * step tries to prerender the page and dies inside a client boundary.
 */
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  post: "Post",
  meeting: "Gathering",
  workshop: "Workshop",
  event: "Event",
  reading_group: "Reading group",
  service: "Offering",
};

function when(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default async function ElkdonisTabPage() {
  const user = await requireUser();
  const viewer = await forumViewerFor(user.id);

  const [profile, editableOrgs, counts, card, announcements, feedback, candidates, artwork] =
    await Promise.all([
      getProfileForUser(user.id),
      getEditableOrgsForUser(user.id),
      getNetworkCounts(),
      getViewerCard(user.id, user.email, viewer),
      getElkdonisTopics(ELKDONIS_FEEDS.announcements, viewer, 6, "newest"),
      getElkdonisTopics(ELKDONIS_FEEDS.feedback, viewer, 6, "active"),
      getCrossPostCandidates(8),
      getArcadeArtwork(),
    ]);

  const profileStatus = isProfileComplete(profile)
    ? "Complete"
    : isProfileInProgress(profile)
      ? "In progress"
      : "Not started";
  const bizStatus = isBusinessComplete(profile)
    ? "Complete"
    : isBusinessInProgress(profile)
      ? "In progress"
      : "Not started";

  const firstOrg = editableOrgs[0] ?? null;
  const wizards: WizardCard[] = [
    { id: "profile", title: "Artist Profile", blurb: "The first onboarding flow. It shapes your public page.", href: "/wizard", status: profileStatus },
    { id: "business", title: "Structure Your Business", blurb: "Entity, pricing, capacity and what support you need.", href: "/wizard/business", status: bizStatus },
    firstOrg
      ? { id: "workshop", title: "Guided Workshop", blurb: `Step-by-step: put a workshop up for ${firstOrg.name}.`, href: `/hub/workshops/${firstOrg.slug}/guided` }
      : { id: "workshop", title: "Start an Organization", blurb: "Claim a subdomain, then list workshops and members.", href: "/hub/organization" },
    { id: "org", title: "Organization Console", blurb: "Drafts, what's coming up, members, files and settings.", href: "/hub/organization" },
    { id: "email", title: "Email Suite", blurb: "Letters, templates and your org's sending identity.", href: "/email" },
    { id: "agreements", title: "Agreements", blurb: "The terms between you, your store and the collective.", href: "/hub/agreements" },
    { id: "quotes", title: "Quotes", blurb: "Keep the lines that carry the work.", href: "/hub/quotes" },
    { id: "wiki", title: "Write a Wiki Page", blurb: "Define a term, or start a page on the network wiki.", href: `${forumBase()}/wiki/new`, external: true },
    { id: "temple", title: "Inner Temple", blurb: "A walkable 3D space for the collective.", href: "/inner-temple" },
    { id: "account", title: "Elkdonis Account", blurb: "Sign-in, avatar and comment colour.", href: "/account" },
  ];

  const slides: PromoSlide[] = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    orgName: c.org_name,
    kind: KIND_LABEL[c.kind] ?? c.kind,
    excerpt: c.excerpt,
    href: forumHref.thread(c.id, c.slug),
  }));

  const sophia = await sophiaLive();
  const today = new Date().toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="ekh">
      {/* ── Banner ─────────────────────────────────────────────────────── */}
      <header className="ekh-mast">
        <div className="ekh-ticker">
          <span className="ekh-ticker__label">Notices</span>
          <div className="ekh-ticker__window">
            <p className="ekh-ticker__scroll">
              {announcements.rows.length
                ? announcements.rows.map((a) => a.title).join("   ·   ")
                : "Welcome to the Elkdonis hub — announcements from the collective appear here."}
            </p>
          </div>
        </div>
        <div className="ekh-mast__row">
          <div className="ekh-mast__ear">
            <span className="ekh-kicker">{today}</span>
            <span className="ekh-small">Elkdonis Arts Collective</span>
          </div>
          <div className="ekh-mast__title">
            <h1>The Elkdonis Hub</h1>
            <p>
              <em>Arts Collective</em> is the main free offering of Elkdonis Arts Collective —
              artists first, and group support in making something for the benefit of all beings.
            </p>
          </div>
          <div className="ekh-mast__ear ekh-mast__ear--r">
            <span className="ekh-mast__count">{counts.members}</span>
            <span className="ekh-kicker">members</span>
            <span className="ekh-mast__count">{counts.orgs}</span>
            <span className="ekh-kicker">organizations</span>
          </div>
        </div>
      </header>

      {/* ── Tall row: forum + welcome ──────────────────────────────────── */}
      <div className="ekh-split">
        <section className="ekh-box" aria-labelledby="ekh-forum">
          <div className="ekh-box__head">
            <div>
              <span className="ekh-kicker">The Grand Forum · Elkdonis</span>
              <h2 id="ekh-forum">Feedback</h2>
            </div>
            <a className="ekh-link" href={forumHref.feed(ELKDONIS_FEEDS.feedback)} target="_blank" rel="noopener">
              All {feedback.total} →
            </a>
          </div>
          <p className="ekh-small">
            One topic per thing — bugs, wishes, confusions, thanks. Everything here is indexed on the
            forum, and the inner group reads every one.
          </p>
          {feedback.rows.length === 0 ? (
            <p className="ekh-empty">No feedback yet. Be the first.</p>
          ) : (
            <ul className="ekh-topics">
              {feedback.rows.map((t) => (
                <li key={t.id}>
                  <a href={forumHref.thread(t.id, t.slug)} target="_blank" rel="noopener">
                    <strong>{t.title}</strong>
                    <span className="ekh-meta">
                      {t.author.name} · {when(t.lastActivityAt)} · {t.replyCount}{" "}
                      {t.replyCount === 1 ? "reply" : "replies"}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <details className="ekh-details">
            <summary className="ekh-btn ekh-btn--ghost">Leave feedback</summary>
            <ComposeForm
              feed={ELKDONIS_FEEDS.feedback}
              submitLabel="Post feedback"
              titlePlaceholder="In a line: what's working, or what isn't?"
              textPlaceholder="What happened, where, and what you expected."
            />
          </details>
          <div className="ekh-box__foot">
            <a className="ekh-link" href={forumHref.feed(ELKDONIS_FEEDS.crossPosts)} target="_blank" rel="noopener">Cross-post suggestions</a>
            <a className="ekh-link" href={`${forumBase()}/o/elkdonis`} target="_blank" rel="noopener">Every Elkdonis category</a>
          </div>
        </section>

        <section className="ekh-box ekh-welcome" aria-labelledby="ekh-welcome">
          <span className="ekh-kicker">Welcome back</span>
          <div className="ekh-welcome__id">
            {card.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.avatarUrl} alt="" className="ekh-avatar" />
            ) : (
              <span className="ekh-avatar ekh-avatar--initials" aria-hidden>{initials(card.displayName)}</span>
            )}
            <div>
              <h2 id="ekh-welcome">{card.displayName}</h2>
              <p className="ekh-small">{card.email}</p>
              {card.isSteward && <span className="ekh-badge">Steward · inner group</span>}
            </div>
          </div>

          <dl className="ekh-facts">
            <div><dt>Artist profile</dt><dd>{profileStatus}</dd></div>
            <div><dt>Business</dt><dd>{bizStatus}</dd></div>
            {card.joinedAt && <div><dt>Member since</dt><dd>{when(card.joinedAt)} {new Date(card.joinedAt).getFullYear()}</dd></div>}
          </dl>

          <div>
            <span className="ekh-kicker">Your organizations</span>
            {card.memberships.length === 0 ? (
              <p className="ekh-small">None yet — you can take part without one, or <Link href="/hub/organization" className="ekh-link">start your own</Link>.</p>
            ) : (
              <ul className="ekh-orgs">
                {card.memberships.map((m) => (
                  <li key={m.orgSlug}>
                    <span>{m.orgName}</span>
                    <span className="ekh-role">{m.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ekh-welcome__actions">
            {profileStatus !== "Complete" && (
              <Link href="/wizard" className="ekh-btn ekh-btn--gold">
                {profileStatus === "In progress" ? "Finish your profile" : "Begin your profile"}
              </Link>
            )}
            <Link href="/account" className="ekh-btn ekh-btn--ghost">Account</Link>
            <Link href="/hub/network" className="ekh-btn ekh-btn--ghost">Community</Link>
          </div>
        </section>
      </div>

      {/* ── Three columns: arcade · announcements · promotion ──────────── */}
      <div className="ekh-three">
        <aside className="ekh-box ekh-box--side" aria-label="Arcade">
          <Arcade artwork={artwork} />
        </aside>

        <section className="ekh-box ekh-news" aria-labelledby="ekh-news">
          <div className="ekh-box__head">
            <div>
              <span className="ekh-kicker">From the stewards</span>
              <h2 id="ekh-news">Elkdonis Announcements</h2>
            </div>
            <a className="ekh-link" href={forumHref.feed(ELKDONIS_FEEDS.announcements)} target="_blank" rel="noopener">
              Archive →
            </a>
          </div>
          {announcements.rows.length === 0 ? (
            <p className="ekh-empty">
              Nothing announced yet. Announcements are posted by the inner group, who steward the
              collective.
            </p>
          ) : (
            <ol className="ekh-stories">
              {announcements.rows.map((a, n) => (
                <li key={a.id} className={n === 0 ? "ekh-story ekh-story--lead" : "ekh-story"}>
                  <span className="ekh-kicker">{when(a.publishedAt ?? a.lastActivityAt)} · {a.author.name}</span>
                  <a href={forumHref.thread(a.id, a.slug)} target="_blank" rel="noopener" className="ekh-story__title">
                    {a.title}
                  </a>
                  {a.excerpt && <p className="ekh-story__excerpt">{a.excerpt}</p>}
                  <span className="ekh-meta">{a.replyCount} {a.replyCount === 1 ? "reply" : "replies"}</span>
                </li>
              ))}
            </ol>
          )}
          {card.isSteward && (
            <details className="ekh-details">
              <summary className="ekh-btn ekh-btn--ghost">Post an announcement</summary>
              <ComposeForm
                feed={ELKDONIS_FEEDS.announcements}
                submitLabel="Announce"
                titlePlaceholder="Headline"
                textPlaceholder="What the collective should know. Blank lines make paragraphs."
              />
            </details>
          )}
        </section>

        <aside className="ekh-box ekh-box--side" aria-label="Across the network">
          <div className="ekh-box__head">
            <div>
              <span className="ekh-kicker">Across the network</span>
              <h2>Cross-posts</h2>
            </div>
          </div>
          <CrossPostSlider
            slides={slides}
            suggest={
              <ComposeForm
                feed={ELKDONIS_FEEDS.crossPosts}
                submitLabel="Suggest it"
                titlePlaceholder="What is it?"
                textPlaceholder="Why the network should see it (optional)"
                withLink
                compact
              />
            }
          />
        </aside>
      </div>

      {/* ── Wizards ────────────────────────────────────────────────────── */}
      <section className="ekh-band" aria-labelledby="ekh-wizards">
        <div className="ekh-band__head">
          <h2 id="ekh-wizards">Wizards</h2>
          <span className="ekh-small">Guided flows that work today</span>
        </div>
        <WizardRail cards={wizards} />
      </section>

      {/* ── Elkdonis Course ───────────────────────────────────────────── */}
      <section className="ekh-course" aria-labelledby="ekh-course">
        <div className="ekh-course__intro">
          <span className="ekh-kicker">{sophia ? "Early outline · on Sophia" : "In preparation"}</span>
          <h2 id="ekh-course">Elkdonis Course</h2>
          <p>
            A curriculum from the collective. It opens with <strong>The Elkdonis Path</strong>, a
            walkable course taken at your own pace, one step at a time: short readings, then a
            reflection that asks one question at a time and is answered, not graded. Later runs will
            be cohorts with live sessions, like the workshops already on the network.
          </p>
        </div>
        <ol className="ekh-course__shape">
          <li>
            <strong>Modules</strong>
            <span>A few themed chapters, taken in order.</span>
          </li>
          <li>
            <strong>Steps</strong>
            <span>A lesson, a reflection, a live session or a resource. Each one opens when the step before it is done.</span>
          </li>
          <li>
            <strong>Reflections</strong>
            <span>Written for yourself first. Asked again after a day, a week and a month.</span>
          </li>
          <li>
            <strong>Completion</strong>
            <span>A record that you walked the Path, and later a badge you can verify.</span>
          </li>
        </ol>
        <div className="ekh-course__foot">
          <p className="ekh-small">{sophia ? "The first outline is up on Sophia, the collective’s new home for courses. " : ""}What should the Path teach?</p>
          <div className="ekh-welcome__actions">
            {sophia && (
              <a className="ekh-btn ekh-btn--gold" href={`${sophia}/elkdonis-path`} target="_blank" rel="noopener">
                Open the Elkdonis Path
              </a>
            )}
            <a className="ekh-btn ekh-btn--ghost" href={forumHref.feed(ELKDONIS_FEEDS.feedback)} target="_blank" rel="noopener">
              Suggest a subject
            </a>
          </div>
        </div>
      </section>

      <div className="ekh-submissions">
        <YourSubmissions userId={user.id} />
      </div>
    </div>
  );
}
