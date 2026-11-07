import { hubStatsRoutes } from "@elkdonis/series-site/routes";
import { seriesSite } from "@/lib/series-site";

export const dynamic = "force-dynamic";

export const { GET } = hubStatsRoutes(seriesSite);
