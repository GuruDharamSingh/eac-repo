import { contentRoutes } from "@elkdonis/content/routes";
import { contentHost } from "@/lib/content-host";

export const dynamic = "force-dynamic";
export const GET = contentRoutes(contentHost).suggest;
