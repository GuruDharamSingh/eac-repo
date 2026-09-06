import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit/submit-form";
import { getCity, listCriteria, listSpecies } from "@/lib/data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Shoot a pigeon",
  description: "Upload a photo, drop a pin, get a trading card. No account needed.",
};

export default async function SubmitPage() {
  const [species, criteria, city] = await Promise.all([
    listSpecies(),
    listCriteria(),
    getCity(siteConfig.defaultCity),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">Shoot a pigeon</h1>
        <p className="mt-2 text-muted-foreground">
          Four steps, no account. Your card goes live the moment you publish it.
        </p>
      </header>

      <SubmitForm
        species={species}
        criteria={criteria}
        cityCenter={city ? [city.centerLat, city.centerLng] : [43.6532, -79.3832]}
        cityZoom={city?.defaultZoom ?? 12}
      />
    </div>
  );
}
