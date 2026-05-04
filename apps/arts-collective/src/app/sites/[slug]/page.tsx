import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { UserDashboardPopover } from "@/components/user-dashboard-popover";
import {
  getOrgBySlug,
  getOrgFeed,
  getFeaturedThread,
  isOrgOwner,
  canEditOrgSite,
  type OrgFeedItem,
} from "@/lib/org";
import { SilexLayout } from "@/components/silex-layout";
import { DISCIPLINE_LABELS } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { CreateContentDialog } from "@/components/cms/create-content-dialog";
import { PinToggle } from "@/components/cms/pin-toggle";
import { SubdomainEditorBar } from "@/components/SubdomainEditorBar";

export default async function OrgSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const user = await getCurrentUser();
  const owner = user ? await isOrgOwner(user.id, org.id) : false;
  const canEdit = user ? owner || (await canEditOrgSite(user.id, org.id)) : false;
  const viewerProfile = user ? await getProfileForUser(user.id) : null;
  const viewerDisplayName = viewerProfile?.display_name ?? null;

  const h = await headers();
  const host = h.get("host") ?? "localhost:3007";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const rootHost = host.replace(new RegExp(`^${slug}\\.`), "");
  const rootBase = `${proto}://${rootHost}`;

  const showSilexLayout =
    org.layout_mode === "silex" && Boolean(org.silex_published_path);

  const [feed, featured] = await Promise.all([
    getOrgFeed(org.id, 20),
    getFeaturedThread(org.id),
  ]);

  const profile = org.profile;
  const disciplines =
    profile?.disciplines?.map(
      (d) => DISCIPLINE_LABELS[d as keyof typeof DISCIPLINE_LABELS] ?? d
    ) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader
        orgName={org.name}
        slug={org.slug}
        owner={owner}
        canEdit={canEdit}
        rootBase={rootBase}
        viewer={
          user
            ? {
                email: user.email,
                displayName: viewerDisplayName,
              }
            : null
        }
      />

      {showSilexLayout ? (
        <SilexLayout org={org} />
      ) : (
        <>
          <IntroSection
            name={profile?.display_name ?? org.name}
            city={profile?.city ?? null}
            bio={profile?.bio ?? org.description}
            photoUrl={profile?.photo_url ?? null}
            disciplines={disciplines}
          />

          <FeaturedSection featured={featured} owner={owner} />

          <FeedSection feed={feed} owner={owner} canEdit={canEdit} orgSlug={slug} />

          <AboutSection
            description={org.description}
            personalPhilosophy={profile?.personal_philosophy ?? null}
            aestheticKeywords={profile?.aesthetic_keywords ?? []}
          />
        </>
      )}

      <SiteFooter orgName={org.name} orgSlug={slug} />
      {canEdit && (
        <SubdomainEditorBar
          orgSlug={slug}
          workshopsUrl={`${proto}://${rootHost}/hub/workshops/${slug}`}
          isOwner={owner}
        />
      )}
    </div>
  );
}

function SiteHeader({
  orgName,
  slug,
  owner,
  canEdit,
  rootBase,
  viewer,
}: {
  orgName: string;
  slug: string;
  owner: boolean;
  canEdit: boolean;
  rootBase: string;
  viewer: { email: string; displayName: string | null } | null;
}) {
  const orgParam = encodeURIComponent(slug);
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-serif text-lg text-foreground hover:text-primary"
        >
          {orgName}
        </Link>
        <div className="flex items-center gap-2">
          {canEdit && <CreateContentDialog orgSlug={slug} />}
          {viewer ? (
            <UserDashboardPopover
              email={viewer.email}
              displayName={viewer.displayName}
              rootBase={rootBase}
              isOwner={owner}
              orgSlug={slug}
            />
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <a href={`/login?org=${orgParam}`}>Sign in</a>
              </Button>
              <Button asChild size="sm">
                <a href={`/login?mode=signup&org=${orgParam}`}>
                  Join
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function IntroSection({
  name,
  city,
  bio,
  photoUrl,
  disciplines,
}: {
  name: string;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  disciplines: string[];
}) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:py-16">
        <div className="flex items-start">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={name}
              className="aspect-[4/5] w-full max-w-sm rounded-md object-cover"
            />
          ) : (
            <div className="flex aspect-[4/5] w-full max-w-sm items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
              <span className="font-serif text-5xl text-muted-foreground/50">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-4">
          {city && (
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {city}
            </p>
          )}
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">
            {name}
          </h1>
          {disciplines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {disciplines.map((d) => (
                <span
                  key={d}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
          {bio && (
            <p className="text-base leading-relaxed text-muted-foreground">
              {bio}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturedSection({
  featured,
  owner,
}: {
  featured: OrgFeedItem | null;
  owner: boolean;
}) {
  if (!featured) {
    if (!owner) return null;
    return (
      <section className="border-b border-border bg-accent/20">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Featured section
          </p>
          <h2 className="mt-2 font-serif text-2xl">
            You haven&apos;t pinned anything yet.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Pin a post, meeting, or workshop to feature it at the top of your
            page. Only you can see this message.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-border bg-accent/30">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Featured {featured.kind}
        </p>
        {featured.slug ? (
          <Link href={`/${featured.slug}`} className="block hover:opacity-80">
            <h2 className="mt-3 font-serif text-3xl leading-tight">{featured.title}</h2>
          </Link>
        ) : (
          <h2 className="mt-3 font-serif text-3xl leading-tight">{featured.title}</h2>
        )}
        {featured.excerpt && (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {featured.excerpt}
          </p>
        )}
        {featured.kind === "workshop" && featured.slug && (
          <Link
            href={`/${featured.slug}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            View workshop →
          </Link>
        )}
        <ThreadLinks thread={featured} className="mt-3" />
      </div>
    </section>
  );
}

function FeedSection({
  feed,
  owner,
  canEdit,
  orgSlug,
}: {
  feed: OrgFeedItem[];
  owner: boolean;
  canEdit: boolean;
  orgSlug: string;
}) {
  const nonFeatured = feed.filter((t) => !t.pinned);

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">Updates</h2>
          {canEdit && (
            <CreateContentDialog
              orgSlug={orgSlug}
              triggerLabel="New post"
              triggerVariant="outline"
            />
          )}
        </div>
        {nonFeatured.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {owner
              ? "Nothing published yet. When you post from the hub, entries will appear here."
              : "No updates yet. Check back soon."}
          </p>
        ) : (
          <ul className="space-y-4">
            {nonFeatured.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-border bg-card p-5"
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span>{t.kind}</span>
                    {t.scheduled_at && (
                      <span>
                        {new Date(t.scheduled_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <PinToggle threadId={t.id} pinned={Boolean(t.pinned)} />
                  )}
                </div>
                {t.slug ? (
                  <Link href={`/${t.slug}`} className="block hover:opacity-80">
                    <h3 className="font-serif text-xl leading-snug">{t.title}</h3>
                  </Link>
                ) : (
                  <h3 className="font-serif text-xl leading-snug">{t.title}</h3>
                )}
                {t.excerpt && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t.excerpt}
                  </p>
                )}
                <ThreadLinks thread={t} className="mt-3" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AboutSection({
  description,
  personalPhilosophy,
  aestheticKeywords,
}: {
  description: string | null;
  personalPhilosophy: string | null;
  aestheticKeywords: string[];
}) {
  const hasKeywords = aestheticKeywords && aestheticKeywords.length > 0;
  if (!description && !personalPhilosophy && !hasKeywords) return null;
  return (
    <section className="border-b border-border bg-muted/20">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 md:grid-cols-2">
        {description && (
          <div>
            <h3 className="font-serif text-xl">About</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        )}
        {(personalPhilosophy || hasKeywords) && (
          <div className="space-y-4">
            {personalPhilosophy && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                  Philosophy
                </h4>
                <p className="mt-1 text-sm leading-relaxed">
                  {personalPhilosophy}
                </p>
              </div>
            )}
            {hasKeywords && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                  Aesthetics
                </h4>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {aestheticKeywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ThreadLinks({
  thread,
  className,
}: {
  thread: OrgFeedItem;
  className?: string;
}) {
  const talkUrl = thread.nextcloud_talk_token
    ? `/api/talk/join?token=${encodeURIComponent(thread.nextcloud_talk_token)}`
    : null;
  const docUrl = thread.nextcloud_doc_url || null;
  const meetingUrl = thread.meeting_url || null;
  if (!talkUrl && !docUrl && !meetingUrl) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {talkUrl && (
        <a
          href={talkUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <span aria-hidden>💬</span> Join Talk room
        </a>
      )}
      {docUrl && (
        <a
          href={docUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <span aria-hidden>📄</span> Open document
        </a>
      )}
      {meetingUrl && !talkUrl && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <span aria-hidden>🔗</span> Meeting link
        </a>
      )}
    </div>
  );
}

function SiteFooter({ orgName, orgSlug }: { orgName: string; orgSlug?: string }) {
  return (
    <footer className="py-8">
      <div className="mx-auto max-w-5xl px-6 text-center text-xs text-muted-foreground">
        {orgSlug && (
          <div className="mb-3">
            <a
              href="/community"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-xs text-foreground hover:bg-accent"
            >
              Community hub &rarr;
            </a>
          </div>
        )}
        <p>
          {orgName} · part of the{" "}
          <Link href="/" className="underline underline-offset-4">
            Elkdonis Arts Collective
          </Link>{" "}
          network
        </p>
      </div>
    </footer>
  );
}
