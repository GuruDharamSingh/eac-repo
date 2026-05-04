import { db } from "@elkdonis/db";
import { SiteShell } from "@/components/site-shell";
import { DISCIPLINE_LABELS } from "@/lib/schema";
import { Button } from "@/components/ui/button";

type Artist = {
  org_id: string;
  slug: string;
  name: string;
  display_name: string;
  city: string;
  bio: string;
  disciplines: string[];
};

async function getArtists(): Promise<Artist[]> {
  try {
    return await db<Artist[]>`
      SELECT
        o.id   AS org_id,
        o.slug AS slug,
        o.name AS name,
        ap.display_name,
        ap.city,
        ap.bio,
        ap.disciplines
      FROM organizations o
      JOIN artist_profiles ap ON ap.org_id = o.id
      ORDER BY ap.display_name ASC
    `;
  } catch {
    return [];
  }
}

export default async function ArtistsPage() {
  const artists = await getArtists();

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl py-12">
        <header className="mb-10 border-b border-border pb-6">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Directory
          </p>
          <h1 className="mt-2 font-serif text-3xl">
            Artists in the collective
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Everyone who has claimed their corner. Click through to any
            artist&apos;s site to see what they&apos;re making and join their
            orbit.
          </p>
        </header>

        {artists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No artists listed yet. Be the first — finish the onboarding wizard
            from the hub.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((a) => (
              <li
                key={a.org_id}
                className="flex flex-col rounded-lg border border-border bg-card p-5"
              >
                <h2 className="font-serif text-xl leading-tight">
                  {a.display_name}
                </h2>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {a.city}
                </p>
                {a.disciplines && a.disciplines.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.disciplines.slice(0, 4).map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs"
                      >
                        {DISCIPLINE_LABELS[
                          d as keyof typeof DISCIPLINE_LABELS
                        ] ?? d}
                      </span>
                    ))}
                  </div>
                )}
                {a.bio && (
                  <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                    {a.bio}
                  </p>
                )}
                <div className="mt-4 pt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={`//${a.slug}.localhost:3007`}>Visit site</a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}
