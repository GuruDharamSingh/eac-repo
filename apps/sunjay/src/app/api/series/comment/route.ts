import { commentRoutes } from "@elkdonis/series-site/routes";
import { seriesSite } from "@/lib/series-site";

export const dynamic = "force-dynamic";

export const { POST } = commentRoutes(seriesSite);
