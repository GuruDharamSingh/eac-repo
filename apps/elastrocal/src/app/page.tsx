import { calculateChart } from "@elkdonis/astro/server";
import { listOrgProfiles } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { ChartBuilder } from "@/components/chart-builder";
import { AstrologersSection, JournalSection, type JournalEntry } from "@/components/home-sections";
import type { ChartFormValues } from "@/components/chart-form";
import { listJournal } from "@/lib/journal";

/**
 * The home page is a chart you can turn.
 *
 * The orbit dial and the wheel sit side by side, and the chart is recast as
 * the date moves; below it, the place, the time and a name, so the thing you
 * were playing with becomes your own chart without starting again somewhere
 * else. Then the people who read charts, what has been written, and the Moon
 * as it is on the date in the dial.
 *
 * The first chart is cast here so the page arrives complete — no spinner on
 * a wheel that is the whole point of the page.
 */
export default async function HomePage() {
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const { name: placeName, latitude, longitude } = siteConfig.skyLocation;

  const initialValues: ChartFormValues = {
    date,
    // Noon, not now: the page opens on a chart rather than on the particular
    // minute it was loaded, and noon is the convention for an unknown time.
    time: "12:00",
    timeKnown: true,
    locationName: placeName,
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "UTC",
    houseSystem: "P",
  };

  const initialChart = calculateChart({
    date,
    time: "12:00",
    timeKnown: true,
    timezone: "UTC",
    latitude,
    longitude,
    houseSystem: "P",
  });

  // Both fail soft: the chart is the page, and a database hiccup should cost
  // a section rather than the whole thing.
  const [people, journal] = await Promise.all([
    listOrgProfiles(siteConfig.orgId, { onlyPublic: true }).catch(() => []),
    listJournal(6).catch((): JournalEntry[] => []),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:py-8">
      <ChartBuilder initialChart={initialChart} initialValues={initialValues}>
        <div className="grid gap-6 lg:grid-cols-2">
          <AstrologersSection people={people} />
          <JournalSection entries={journal} />
        </div>
      </ChartBuilder>
    </div>
  );
}
