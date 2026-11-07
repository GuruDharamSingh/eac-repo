import { notFound } from "next/navigation";
import { PuckPage, pageData } from "@/lib/puck/render";
import { HOME_SLUG } from "@/lib/puck/store";
import { DEFAULT_HOME } from "@/lib/default-pages";

// Session-dependent header and "Edit this page" -> always render fresh.
export const dynamic = "force-dynamic";

/**
 * `/` is the studio document `home` (site_config `puck:home`). Until Ario
 * publishes one, it draws DEFAULT_HOME (lib/default-pages.ts): the live Silex
 * home's words, the ÆON draft's opening, the figure and the course. The Silex
 * home (index) is no longer drawn here; it stays in Nextcloud, untouched.
 */
export default async function Home() {
  const data = await pageData(HOME_SLUG, DEFAULT_HOME);
  if (!data) notFound();
  return <PuckPage slug={HOME_SLUG} data={data} />;
}
