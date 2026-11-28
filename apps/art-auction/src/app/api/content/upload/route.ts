import { contentRoutes } from "@elkdonis/content/routes";
import { contentHost } from "@/lib/content-host";

export const dynamic = "force-dynamic";
// Answers 501 until Step 5 (the media lane builds uploads).
export const POST = contentRoutes(contentHost).upload!;
