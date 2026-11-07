import { rsvpRoutes } from "@elkdonis/series-site/routes";
import { seriesSite } from "@/lib/series-site";

export const dynamic = "force-dynamic";

export const { POST } = rsvpRoutes(seriesSite);
