import Link from "next/link";
import type { Metadata } from "next";
import { listOrgProfiles } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

/** The org's public guides — org_profiles rows marked public, identity from users. */
export default async function PeoplePage() {
  const people = await listOrgProfiles(siteConfig.orgId, { onlyPublic: true }).catch(() => []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">People</p>
      <h1 className="mt-2 text-3xl font-semibold md:text-4xl">The guides of {siteConfig.orgName}</h1>

      {people.length === 0 ? (
        <p className="mt-14 text-muted-foreground">No one is listed yet.</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <Link
              key={p.userId}
              href={p.slug ? `/people/${p.slug}` : "/people"}
              className="group flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/60"
            >
              <div className="size-16 shrink-0 overflow-hidden rounded-full bg-muted">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center font-display text-xl text-muted-foreground">
                    {p.displayName.slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-lg group-hover:text-primary">{p.displayName}</h2>
                {(p.roleTitle || p.headline) && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.roleTitle ?? p.headline}</p>
                )}
                {p.city && <p className="mt-1 text-xs text-muted-foreground">{p.city}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
