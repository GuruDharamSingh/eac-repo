import { RelayChat, RelayFeeds } from "@elkdonis/reels/editor";
import { relayConfigured } from "@elkdonis/services/relay";
import { relayAddFeed, relayChat, relayFeedToScene, relayRemoveFeed, relayView } from "@/lib/relay-actions";

/**
 * The stream relay's Feeds in and the destinations' Chat, for the broadcast console's and desk's
 * `extra` slot (/studio/broadcast, /studio/broadcast/desktop). Nothing when
 * the relay is not configured. The tab id (the page's lease) comes from
 * BroadcastTabContext inside the console.
 */
export function RelayFeedsSlot() {
  if (!relayConfigured()) return null;
  return (
    <>
      <h2>Feeds in</h2>
      <section className="vs-slot">
        <RelayFeeds
          actions={{
            view: relayView,
            addFeed: relayAddFeed,
            removeFeed: relayRemoveFeed,
            feedToScene: relayFeedToScene,
            ingestUrl: process.env.RELAY_PUBLIC_INGEST_URL || "rtmp://relay:1935/in",
            guestCameraPath: process.env.RELAY_GUEST_CAMERAS === "1" ? "/guest/camera" : undefined,
          }}
        />
      </section>
      <h2>Chat</h2>
      <section className="vs-slot">
        <RelayChat chat={relayChat} />
      </section>
    </>
  );
}
