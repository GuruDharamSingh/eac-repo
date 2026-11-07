import type { Metadata } from "next";
import { SeriesIndexPage, seriesIndexMetadata } from "@elkdonis/series-site/pages";
import { seriesSite } from "@/lib/series-site";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return seriesIndexMetadata(seriesSite);
}

export default function Page() {
  return <SeriesIndexPage site={seriesSite} />;
}
