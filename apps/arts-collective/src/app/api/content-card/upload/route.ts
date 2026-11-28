import { contentRoutes } from "@elkdonis/content/routes";
import { contentCardHost } from "@/lib/content-card-host";

export const dynamic = "force-dynamic";

/** POST /api/content-card/upload: multipart `file` + `source` (`mine` or `org:<id>`). The org folder needs an owner or guide (the route checks). */
export const POST = contentRoutes(contentCardHost).upload;
