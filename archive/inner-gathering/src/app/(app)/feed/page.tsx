import { getFeed, getRecurringMeetings } from "@/lib/data";
import { listForumThreads } from "@/lib/forum";
import { fetchSubstackPosts } from "@/lib/substack";
import { FEED_TAB_ORDER_KEY, normalizeTabOrder } from "@/lib/feed-tabs";
import { FeedClient } from "@/components/feed-client";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";

// site_config rows for the collective are keyed under this org id (see
// /api/admin/site-config). The feed content itself lives under inner_group.
const SITE_CONFIG_ORG = "elkdonis";

async function getTabOrder() {
  try {
    const [row] = await db`
      SELECT value FROM site_config
      WHERE org_id = ${SITE_CONFIG_ORG} AND key = ${FEED_TAB_ORDER_KEY}
      LIMIT 1
    `;
    return normalizeTabOrder(row?.value);
  } catch {
    return normalizeTabOrder(null);
  }
}

export default async function FeedPage() {
  const session = await getServerSession();
  const userId = session?.user?.id ?? null;
  const userIsAdmin = userId ? await isAdmin(userId) : false;

  const [feedItems, recurringMeetings, forumThreads, substackPosts, tabOrder] =
    await Promise.all([
      getFeed(userIsAdmin),
      getRecurringMeetings(),
      listForumThreads(),
      fetchSubstackPosts(10),
      getTabOrder(),
    ]);

  return (
    <FeedClient
      initialFeed={feedItems}
      recurringMeetings={recurringMeetings}
      forumThreads={forumThreads}
      substackPosts={substackPosts}
      tabOrder={tabOrder}
      userId={userId}
      isAdmin={userIsAdmin}
    />
  );
}
