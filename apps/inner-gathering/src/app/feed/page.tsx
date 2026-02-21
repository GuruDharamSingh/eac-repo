import { getFeed, getRecurringMeetings } from "@/lib/data";
import { FeedClient } from "@/components/feed-client";

export default async function FeedPage() {
  const [feedItems, recurringMeetings] = await Promise.all([
    getFeed(),
    getRecurringMeetings(),
  ]);

  return <FeedClient initialFeed={feedItems} recurringMeetings={recurringMeetings} />;
}
