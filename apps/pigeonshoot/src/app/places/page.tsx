import Link from "next/link";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { listCities } from "@/lib/data";

export const metadata: Metadata = { title: "Places" };

export default async function PlacesPage() {
  const cities = await listCities();

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">Places</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Toronto first. The structure is city then neighbourhood, so other cities can join
        without anything changing.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {cities.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/places/${c.slug}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <span>
                <span className="font-display text-xl font-semibold">{c.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {c.region}, {c.country}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {c.cardCount ?? 0}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
