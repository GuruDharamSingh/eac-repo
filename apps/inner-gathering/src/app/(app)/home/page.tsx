import { Suspense } from "react";
import { HomeClient } from "@/components/home-client";
import { getFeed } from "@/lib/data";

export default async function HomePage() {
  // Fetch initial data
  const feedItems = await getFeed();

  // Get upcoming meetings (next 3)
  const upcomingMeetings = feedItems
    .filter(item => item.type === "meeting")
    .slice(0, 3);

  // Get recent posts (last 3)
  const recentPosts = feedItems
    .filter(item => item.type === "post")
    .slice(0, 3);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeClient
        upcomingMeetings={upcomingMeetings}
        recentPosts={recentPosts}
      />
    </Suspense>
  );
}
