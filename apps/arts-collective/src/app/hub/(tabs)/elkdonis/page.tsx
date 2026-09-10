import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  getProfileForUser,
  isProfileComplete,
  isProfileInProgress,
  isBusinessComplete,
  isBusinessInProgress,
} from "@/lib/profile";
import { getMemberRoster } from "@/lib/network";
import { getEditableOrgsForUser } from "@/lib/org";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { HubCard } from "@/components/hub/HubCard";
import { HUB_CARDS, SITE_PANELS, type CardStatus } from "@/lib/hub-cards";
import { Button } from "@/components/ui/button";
import { YourSubmissions } from "@/components/hub/YourSubmissions";

/**
 * Reads the session cookie, so it can never be a static page. Declared
 * rather than left to Next's automatic bailout: without it the export
 * step tries to prerender the page and dies inside a client boundary.
 */
export const dynamic = "force-dynamic";

export default async function ElkdonisTabPage() {
  const user = await requireUser();
  const [profile, editableOrgs, homes] = await Promise.all([
    getProfileForUser(user.id),
    getEditableOrgsForUser(user.id),
    orgHomeUrlMap(),
  ]);
  const isNewMember = editableOrgs.length === 0;

  const complete = isProfileComplete(profile);
  const inProgress = isProfileInProgress(profile);
  const bizComplete = isBusinessComplete(profile);
  const bizInProgress = isBusinessInProgress(profile);

  const cardStatus = (id: string): CardStatus => {
    if (id === "artist_profile") {
      if (complete) return "complete";
      if (inProgress) return "in_progress";
      return "not_started";
    }
    if (id === "structure_business") {
      if (bizComplete) return "complete";
      if (bizInProgress) return "in_progress";
      return "not_started";
    }
    const card = HUB_CARDS.find((c) => c.id === id);
    return card?.available ? "not_started" : "locked";
  };

  const panelStatus = (id: string): CardStatus => {
    const p = SITE_PANELS.find((c) => c.id === id);
    return p?.available ? "not_started" : "locked";
  };

  const resumeCard = HUB_CARDS.find((c) => c.id === "artist_profile");
  const resumeStatus = cardStatus("artist_profile");
  const showResume =
    resumeStatus === "not_started" || resumeStatus === "in_progress";

  const roster = await getMemberRoster(8);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-10 space-y-2 border-b border-border pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Welcome to the Collective
        </p>
        <h1 className="font-serif text-4xl leading-tight text-foreground md:text-5xl">
          Arts Collective is the main free offering of Elkdonis Arts
          Collective.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          We separate <em>Arts Collective</em> as a network from the full
          name <em>Elkdonis Arts Collective</em> to allow users and artists
          to be put first — and to suggest the generality and diffused
          quality this work really has. By that we refer to the core
          Elkdonis principle of the group, and of group support in creating
          something for the benefit of all beings.
        </p>
      </header>

      {isNewMember && (
        <section className="mb-10 rounded-lg border border-primary/30 bg-accent/30 p-6">
          <p className="text-xs uppercase tracking-wider text-primary">
            Welcome
          </p>
          <h2 className="mt-1 font-serif text-2xl leading-tight text-foreground">
            You&apos;re in. Where would you like to start?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            There&apos;s no wrong door. Browse and take part without running
            anything of your own, or claim a subdomain and get the full set
            of tools — you can always do the other later.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
              <h3 className="font-serif text-lg text-foreground">
                Explore the network
              </h3>
              <p className="text-sm text-muted-foreground">
                Community feed, artist directory, events across the
                collective — no setup required.
              </p>
              <Button asChild variant="outline" className="mt-auto w-fit">
                <Link href="/hub/network">Go to Network →</Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
              <h3 className="font-serif text-lg text-foreground">
                Create your organization
              </h3>
              <p className="text-sm text-muted-foreground">
                Claim a subdomain, publish your site, list workshops, and
                manage members.
              </p>
              <Button asChild className="mt-auto w-fit">
                <Link href="/hub/organization">Start your org →</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="mb-10 max-w-2xl space-y-4 border-l-2 border-accent/70 pl-5">
        <p className="text-base leading-relaxed text-foreground/90">
          This network aims to be as transparent as possible in providing
          the structured web portal that will aid in connecting people who
          are interested in artists to the artists — and artists to other
          artists, and to the people around them.
        </p>
        <p className="text-base leading-relaxed text-foreground/90">
          We are not looking to control or manage any of the offerings being
          presented through our network. We do ask that people are willing
          to participate in the aims of the network — openness, mutual aid,
          support. There are opportunities to go deeper into what our
          collective is, but that&apos;s not necessary — it&apos;s not even
          necessarily encouraged. If you show up as an active artist in the
          community, there is space and attention for you to become more
          integrated. You might also use our site and never try to deepen
          your connection with the network, and that&apos;s totally fine.
          You&apos;re doing enough by being present. Thank you.
        </p>
      </section>

      {showResume && resumeCard && (
        <section className="mb-10 rounded-lg border border-primary/30 bg-accent/30 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-primary">
                {resumeStatus === "in_progress" ? "Next step" : "Start here"}
              </p>
              <h2 className="mt-1 font-serif text-xl leading-tight">
                {resumeStatus === "in_progress"
                  ? "Finish your Artist Profile"
                  : "Begin your Artist Profile"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {resumeStatus === "in_progress"
                  ? "Pick up where you left off."
                  : "The first onboarding process. It shapes your public page."}
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={resumeCard.href ?? "#"}>
                {resumeStatus === "in_progress" ? "Resume" : "Start"}
              </Link>
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">
            Deepen your ties
          </h2>
          <span className="text-xs text-muted-foreground">
            {HUB_CARDS.filter((c) => c.available).length} active ·{" "}
            {HUB_CARDS.filter((c) => !c.available).length} coming soon
          </span>
        </div>
        <div className="-mx-6 overflow-x-auto px-6 pb-4">
          <div className="flex gap-4">
            {HUB_CARDS.map((card) => (
              <HubCard key={card.id} card={card} status={cardStatus(card.id)} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">
            Platform &amp; account
          </h2>
          <span className="text-xs text-muted-foreground">
            {SITE_PANELS.filter((c) => c.available).length} active
          </span>
        </div>
        <div className="-mx-6 overflow-x-auto px-6 pb-4">
          <div className="flex gap-4">
            {SITE_PANELS.map((card) => (
              <HubCard key={card.id} card={card} status={panelStatus(card.id)} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">
            Get to know other members
          </h2>
          <Link
            href="/artists"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Browse all artists →
          </Link>
        </div>
        {roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members listed yet.
          </p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6 pb-4">
            <div className="flex gap-4">
              {roster.map((m) => (
                <a
                  key={m.user_id}
                  href={orgHomeUrl(homes, m.slug)}
                  target="_blank"
                  rel="noopener"
                  className="flex h-full min-h-[140px] w-[240px] shrink-0 flex-col justify-between rounded-lg border border-border bg-card p-4 transition hover:border-primary/60"
                >
                  <div className="space-y-1">
                    <p className="font-serif text-base leading-snug text-foreground">
                      {m.display_name}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {m.city}
                    </p>
                  </div>
                  {m.bio && (
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {m.bio}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      <YourSubmissions userId={user.id} />

      <section className="mt-12 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
        <Button asChild size="lg" variant="outline">
          <Link href="/hub/network">See what&apos;s happening across the network</Link>
        </Button>
      </section>
    </div>
  );
}
