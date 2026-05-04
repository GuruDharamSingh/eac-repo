import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { canEditOrgSite } from "@/lib/org";
import { getWorkshopThreadsForOrg } from "@/lib/org";
import { db } from "@elkdonis/db";

export default async function WorkshopListPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser();

  const orgs = await db<{ id: string; name: string }[]>`
    SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1
  `;
  const org = orgs[0];
  if (!org) notFound();

  const allowed = await canEditOrgSite(user.id, org.id);
  if (!allowed) redirect("/hub");

  const workshops = await getWorkshopThreadsForOrg(org.id);

  return (
    <SiteShell>
      <div className="py-10">
        <header className="mb-8 flex items-end justify-between border-b border-border pb-6">
          <div>
            <Link
              href="/hub"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Hub
            </Link>
            <h1 className="mt-2 font-serif text-3xl text-foreground">
              Workshops
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{org.name}</p>
          </div>
          <Button asChild>
            <Link href={`/hub/workshops/${orgSlug}/new`}>New workshop</Link>
          </Button>
        </header>

        {workshops.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No workshops yet. Create your first one.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href={`/hub/workshops/${orgSlug}/new`}>New workshop</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {workshops.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-md border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">
                      {w.title}
                    </p>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[11px] uppercase tracking-wider ${
                        w.status === "published"
                          ? "border-green-300 text-green-700"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {w.status}
                    </span>
                    {w.registration_status && w.registration_status !== "open" && (
                      <span className="rounded border border-amber-300 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-amber-700">
                        {w.registration_status}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                    {w.discipline && <span>{w.discipline}</span>}
                    {w.scheduled_at && (
                      <span>
                        {new Date(w.scheduled_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/hub/workshops/${orgSlug}/${w.id}`}>Edit</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}
