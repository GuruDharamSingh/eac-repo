import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * Whether a gathering has asked for the designed detail page
 * (`threads.metadata.detailPage`, set by setDetailPageAction). Read per
 * request by the thread route. Kept out of event-actions.ts because every
 * export of a "use server" file is callable from the browser.
 */
export async function readDetailPage(threadId: string): Promise<boolean> {
  try {
    const [row] = await db<{ on: boolean | null }[]>`
      SELECT (metadata->>'detailPage')::boolean AS on FROM threads
      WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
    `;
    return Boolean(row?.on);
  } catch {
    return false;
  }
}
