import { contentRoutes } from "@elkdonis/content/routes";
import { contentCardHost } from "@/lib/content-card-host";

export const dynamic = "force-dynamic";

/** GET /api/content-card/folders?source=&path=: the Content card's Files view. Sources come from the session (content-card-host.ts). */
export const GET = contentRoutes(contentCardHost).folders;
