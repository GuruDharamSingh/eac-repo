import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getProfileForUser,
  isProfileComplete,
  isProfileInProgress,
  isBusinessComplete,
  isBusinessInProgress,
} from "@/lib/profile";
import { SiteShell } from "@/components/site-shell";
import { HubCard } from "@/components/hub/HubCard";
import {
  HUB_CARDS,
  SITE_PANELS,
  type CardStatus,
} from "@/lib/hub-cards";
import { Button } from "@/components/ui/button";
import { getCommunityFeed } from "@/lib/community-feed";
import { SilexSurfaceControls } from "@/components/hub/SilexSurfaceControls";
import { PublishSection } from "@/components/hub/PublishSection";
import { getEditableOrgsForUser } from "@/lib/org";

export default async function HubPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);

  if (!profile) {
    redirect("/signup/setup");
  }

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

  const greetingName = profile.display_name || user.email.split("@")[0];
  const subdomainLabel = `${profile.org_id}.localhost:3007`;
  const subdomainUrl = `http://${profile.org_id}.localhost:3007`;

  const resumeCard = HUB_CARDS.find((c) => c.id === "artist_profile");
  const resumeStatus = cardStatus("artist_profile");
  const showResume =
    resumeStatus === "not_started" || resumeStatus === "in_progress";

  const [feed, editableOrgs] = await Promise.all([
    getCommunityFeed(10),
    getEditableOrgsForUser(user.id),
  ]);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <header className="mb-10 flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Onboarding Hub
            </p>
            <h1 className="font-serif text-4xl leading-tight text-foreground">
              Welcome back, {greetingName}.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Each card below is one way to go deeper. None of them are
              required — you can come back to any of them any time.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Your site
            </span>
            <div className="flex items-center gap-3">
              <code className="rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-sm text-foreground">
                {subdomainLabel}
              </code>
              <Button asChild variant="outline" size="sm">
                <a href={subdomainUrl} target="_blank" rel="noopener">
                  Open ↗
                </a>
              </Button>
            </div>
          </div>
        </header>

        {showResume && resumeCard && (
          <section className="mb-10 rounded-lg border border-primary/30 bg-accent/30 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary">
                  {resumeStatus === "in_progress"
                    ? "Next step"
                    : "Start here"}
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

        <section className="mb-10 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">Publish</h2>
            <span className="text-xs text-muted-foreground">
              Create &amp; share content
            </span>
          </div>
          <PublishSection orgSlug={profile.org_id} />
        </section>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">
              Onboarding processes
            </h2>
            <span className="text-xs text-muted-foreground">
              {HUB_CARDS.filter((c) => c.available).length} active ·{" "}
              {HUB_CARDS.filter((c) => !c.available).length} coming soon
            </span>
          </div>
          <div className="-mx-6 overflow-x-auto px-6 pb-4">
            <div className="flex gap-4">
              {HUB_CARDS.map((card) => (
                <HubCard
                  key={card.id}
                  card={card}
                  status={cardStatus(card.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">
              Site & account
            </h2>
            <span className="text-xs text-muted-foreground">
              {SITE_PANELS.filter((c) => c.available).length} active
            </span>
          </div>
          <div className="-mx-6 overflow-x-auto px-6 pb-4">
            <div className="flex gap-4">
              {SITE_PANELS.map((card) => (
                <HubCard
                  key={card.id}
                  card={card}
                  status={panelStatus(card.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">
              Website editor
            </h2>
            <span className="text-xs text-muted-foreground">
              {editableOrgs.length} editable
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {editableOrgs.map((org) => (
              <div
                key={org.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">
                      {org.name}
                    </p>
                    <span className="rounded border border-border px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {org.role}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-sm text-muted-foreground">
                    {org.slug}.localhost:3007
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Public surface: {org.layout_mode === "silex" ? "Silex" : "default Arts layout"}
                  </p>
                  {!org.nextcloud_folder_path && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Nextcloud project folder will be created on first launch.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/hub/workshops/${org.slug}`}>
                      Workshops
                    </Link>
                  </Button>
                  <SilexSurfaceControls
                    slug={org.slug}
                    layoutMode={org.layout_mode}
                    hasPublished={Boolean(org.silex_published_path)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">
              Ongoing artist efforts
            </h2>
            <Link
              href="/artists"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Browse all artists →
            </Link>
          </div>
          {feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The community feed is quiet right now. As artists publish posts,
              meetings, and workshops, they&apos;ll appear here.
            </p>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6 pb-4">
              <div className="flex gap-4">
                {feed.map((item) => (
                  <article
                    key={item.id}
                    className="flex h-full min-h-[160px] w-[280px] shrink-0 flex-col justify-between rounded-lg border border-border bg-card p-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                        <span>{item.kind}</span>
                        <span>·</span>
                        <a
                          href={`http://${item.orgSlug}.localhost:3007`}
                          target="_blank"
                          rel="noopener"
                          className="text-foreground hover:underline"
                        >
                          {item.orgName}
                        </a>
                      </div>
                      <h3 className="font-serif text-base leading-snug">
                        {item.title}
                      </h3>
                      {item.excerpt && (
                        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                          {item.excerpt}
                        </p>
                      )}
                    </div>
                    {(item.scheduledAt || item.publishedAt) && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {new Date(
                          item.scheduledAt ?? item.publishedAt ?? ""
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
            </div>
          )}
        </section>
      </div>
    </SiteShell>
  );
}
