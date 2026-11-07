import type { Metadata } from "next";
import { SeriesPage, seriesPageMetadata } from "@elkdonis/series-site/pages";
import { seriesSite } from "@/lib/series-site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return seriesPageMetadata(seriesSite, params);
}

export default function Page({ params }: Props) {
  return <SeriesPage site={seriesSite} params={params} />;
}
