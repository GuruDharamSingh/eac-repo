import { getFeed, getRecurringMeetings } from "@/lib/data";
import { listForumThreads } from "@/lib/forum";
import { FeedClient } from "@/components/feed-client";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";

export default async function FeedPage() {
  const session = await getServerSession();
  const userId = session?.user?.id ?? null;
  const userIsAdmin = userId ? await isAdmin(userId) : false;

  const [feedItems, recurringMeetings, forumThreads] = await Promise.all([
    getFeed(userIsAdmin),
    getRecurringMeetings(),
    listForumThreads(),
  ]);

  return (
    <FeedClient
      initialFeed={feedItems}
      recurringMeetings={recurringMeetings}
      forumThreads={forumThreads.slice(0, 8)}
      userId={userId}
      isAdmin={userIsAdmin}
    />
  );
}
