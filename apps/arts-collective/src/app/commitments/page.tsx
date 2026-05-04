import Link from "next/link";
import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCommitmentsForUser, type Commitment } from "@/lib/commitments";

function groupByKind(items: Commitment[]) {
  const groups = {
    membership: [] as Commitment[],
    rsvp: [] as Commitment[],
    watch: [] as Commitment[],
    bookmark: [] as Commitment[],
  };
  for (const c of items) groups[c.kind].push(c);
  return groups;
}

export default async function CommitmentsPage() {
  const user = await requireUser();
  const items = await getCommitmentsForUser(user.id);
  const groups = groupByKind(items);
  const total = items.length;

  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl py-12">
        <header className="mb-8 border-b border-border pb-6">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Commitments
          </p>
          <h1 className="mt-2 font-serif text-3xl">
            What you&apos;ve said yes to
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Everything you&apos;ve joined, RSVP&apos;d to, watched, or
            bookmarked across the collective — pulled from all the orgs
            you&apos;re connected to.
          </p>
        </header>

        {total === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">
                Nothing yet.
              </CardTitle>
              <CardDescription>
                As you RSVP to meetings, join other orgs, or bookmark posts,
                they&apos;ll appear here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/artists">Explore artists</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <Group
              title="Orgs you belong to"
              empty="You haven't joined any other orgs yet."
              items={groups.membership}
              render={(c) =>
                c.kind === "membership" && (
                  <li
                    key={c.orgId}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="font-serif text-base">{c.orgName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.role} · since{" "}
                        {new Date(c.since).toLocaleDateString()}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={`//${c.orgSlug}.localhost:3007`}>Visit</a>
                    </Button>
                  </li>
                )
              }
            />
            <Group
              title="RSVPs"
              empty="No upcoming RSVPs."
              items={groups.rsvp}
              render={(c) =>
                c.kind === "rsvp" && (
                  <li
                    key={c.threadId}
                    className="rounded-md border border-border bg-card px-4 py-3"
                  >
                    <p className="font-serif text-base">{c.threadTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.orgSlug}
                      {c.scheduledAt
                        ? ` · ${new Date(c.scheduledAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </li>
                )
              }
            />
            <Group
              title="Watching"
              empty="Not watching anything."
              items={groups.watch}
              render={(c) =>
                c.kind === "watch" && (
                  <li
                    key={c.threadId}
                    className="rounded-md border border-border bg-card px-4 py-3"
                  >
                    <p className="font-serif text-base">{c.threadTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.orgSlug}
                    </p>
                  </li>
                )
              }
            />
            <Group
              title="Bookmarks"
              empty="No bookmarks yet."
              items={groups.bookmark}
              render={(c) =>
                c.kind === "bookmark" && (
                  <li
                    key={c.threadId}
                    className="rounded-md border border-border bg-card px-4 py-3"
                  >
                    <p className="font-serif text-base">{c.threadTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.orgSlug}
                    </p>
                  </li>
                )
              }
            />
          </div>
        )}
      </div>
    </SiteShell>
  );
}

function Group({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: Commitment[];
  render: (c: Commitment) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-serif text-xl">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">{items.map(render)}</ul>
      )}
    </section>
  );
}
