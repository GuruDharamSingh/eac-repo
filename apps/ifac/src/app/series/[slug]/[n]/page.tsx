import type { Metadata } from "next";
import { SeriesWeekPage, seriesWeekMetadata } from "@elkdonis/series-site/pages";
import { seriesSite } from "@/lib/series-site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; n: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return seriesWeekMetadata(seriesSite, params);
}

export default function Page({ params }: Props) {
  return <SeriesWeekPage site={seriesSite} params={params} />;
}
