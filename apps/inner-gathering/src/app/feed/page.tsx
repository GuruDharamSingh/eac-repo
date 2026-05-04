import { getFeed, getRecurringMeetings } from "@/lib/data";
import { FeedClient } from "@/components/feed-client";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";

export default async function FeedPage() {
  const [feedItems, recurringMeetings, session] = await Promise.all([
    getFeed(),
    getRecurringMeetings(),
    getServerSession(),
  ]);
  const userId = session?.user?.id ?? null;
  const userIsAdmin = userId ? await isAdmin(userId) : false;

  return (
    <FeedClient
      initialFeed={feedItems}
      recurringMeetings={recurringMeetings}
      userId={userId}
      isAdmin={userIsAdmin}
    />
  );
}
