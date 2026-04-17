import { getFeed, getRecurringMeetings } from "@/lib/data";
import { FeedClient } from "@/components/feed-client";
import { getServerSession } from "@elkdonis/auth-server";

export default async function FeedPage() {
  const [feedItems, recurringMeetings, session] = await Promise.all([
    getFeed(),
    getRecurringMeetings(),
    getServerSession(),
  ]);

  return (
    <FeedClient
      initialFeed={feedItems}
      recurringMeetings={recurringMeetings}
      userId={session?.user?.id ?? null}
    />
  );
}
