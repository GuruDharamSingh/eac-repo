import Link from "next/link";
import type { Store } from "@elkdonis/commerce/types";

/**
 * The people, not the inventory.
 *
 * Four artists is a small number to hide and a good number to introduce. On a
 * collective's marketplace the maker is the reason to buy, so they get a band
 * of their own rather than being a link in the footer.
 */
export function ArtistRow({ artists }: { artists: Store[] }) {
  if (artists.length === 0) return null;

  return (
    <section aria-labelledby="artists-band">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="artists-band" className="font-serif text-2xl tracking-tight">
            The artists
          </h2>
          <p className="mt-1 text-sm text-ink-faint">
            Everyone selling here is a member of the collective.
          </p>
        </div>
        <Link href="/artists" className="text-sm underline-offset-4 hover:underline">
          All artists →
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {artists.map((a) => (
          <li key={a.id}>
            <Link
              href={`/artists/${a.slug ?? a.id}`}
              className="group flex flex-col items-center text-center"
            >
              <span className="h-24 w-24 overflow-hidden rounded-full bg-wall ring-1 ring-border">
                {a.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      a.photoUrl.includes("/api/media/") && !a.photoUrl.includes("?")
                        ? `${a.photoUrl}?w=256`
                        : a.photoUrl
                    }
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-serif text-2xl text-ink-faint">
                    {(a.displayName ?? "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.13em] underline-offset-4 group-hover:underline">
                {a.displayName ?? "Unnamed artist"}
              </span>
              {a.city && <span className="mt-1 text-xs text-ink-faint">{a.city}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
