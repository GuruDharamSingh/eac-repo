import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Email moved to /manage/email (2026-09-19). Kept as a redirect rather than
 * deleted: this URL is in the hub's history, in bookmarks, and in the footer
 * of test sends. The tab rides along so a link to one tab still lands there.
 */
export default async function HubEmailRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(tab ? `/manage/email?tab=${encodeURIComponent(tab)}` : "/manage/email");
}
