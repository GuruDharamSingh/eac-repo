import Link from "next/link";
import type { Metadata } from "next";
import { SIGN_BY_KEY, type SignKey } from "@elkdonis/astro";
import { Star } from "lucide-react";
import { getIdentity } from "@/lib/auth";
import { claimGuestCharts, listCharts, type ChartListItem } from "@/lib/charts";
import { Button } from "@/components/ui/button";
import { ELEMENT_TEXT, Glyph } from "@/components/chart/glyph";
import { ChartWheel } from "@elkdonis/sky-ui";

export const metadata: Metadata = { title: "Your charts" };

function Big3({ label, sign }: { label: string; sign: SignKey | null }) {
  if (!sign) return null;
  const s = SIGN_BY_KEY[sign];
  return (
    <span className="inline-flex items-center gap-1" title={`${label} in ${s.name}`}>
      <span className="text-muted-foreground">{label}</span>
      <Glyph className={ELEMENT_TEXT[s.element]}>{s.glyph}</Glyph>
    </span>
  );
}

function ChartCard({ c }: { c: ChartListItem }) {
  return (
    <Link
      href={`/charts/${c.id}`}
      className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/60"
    >
      {c.chart && (
        <div className="mx-auto mb-4 w-4/5">
          <ChartWheel chart={c.chart} variant="compact" />
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg group-hover:text-primary">{c.name}</h3>
        {c.isFavorite && <Star className="size-4 shrink-0 fill-primary text-primary" aria-label="Favourite" />}
      </div>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        {c.birthDate} · {c.birthTime}
      </p>
      <p className="truncate text-sm text-muted-foreground">{c.locationName ?? "Coordinates only"}</p>
      <div className="mt-4 flex gap-4 text-sm">
        <Big3 label="☉" sign={c.sun} />
        <Big3 label="☽" sign={c.moon} />
        <Big3 label="AC" sign={c.rising} />
      </div>
    </Link>
  );
}

function SignInNudge({ hasCharts }: { hasCharts: boolean }) {
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/10 px-5 py-4 text-sm">
      <p>
        {hasCharts
          ? "These charts are kept in this browser only. "
          : "Charts you save are kept in this browser. "}
        <Link href="/login?next=/charts" className="font-medium text-primary underline underline-offset-4">
          Sign in
        </Link>{" "}
        to keep them across devices and never lose them to a cleared cookie — one account works across the whole
        Elkdonis network.
      </p>
    </div>
  );
}

export default async function ChartsPage() {
  const { viewer, guestId, keeper } = await getIdentity();
  // A guest who has just signed in: their charts follow them.
  if (viewer && guestId) await claimGuestCharts(guestId, viewer.userId);

  const charts = keeper ? await listCharts(keeper) : [];
  const favourites = charts.filter((c) => c.isFavorite);
  const others = charts.filter((c) => !c.isFavorite);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold md:text-4xl">Your charts</h1>
        <Button asChild>
          <Link href="/calculate">New chart</Link>
        </Button>
      </div>

      {!viewer && (
        <div className="mb-8">
          <SignInNudge hasCharts={charts.length > 0} />
        </div>
      )}

      {charts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-display text-2xl">No charts yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Calculate one and save it to keep it here.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {favourites.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Favourites</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favourites.map((c) => (
                  <ChartCard key={c.id} c={c} />
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {favourites.length > 0 ? "Everything else" : "Saved"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((c) => (
                  <ChartCard key={c.id} c={c} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
