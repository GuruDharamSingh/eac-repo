import { getFeed } from "@/lib/data";
import { FeedClient } from "@/components/feed-client";

export default async function FeedPage() {
  const feedItems = await getFeed();

  return <FeedClient initialFeed={feedItems} />;
}
