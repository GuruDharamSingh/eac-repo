"use client";

import type { OrgChatIdentity, OrgChatMessage } from "@elkdonis/services";
import { ChatTranscript } from "./ChatTranscript";

/**
 * The expanded General Chat: the same room and the same transcript as the hub
 * card, given the height to actually hold a conversation.
 *
 * `nextcloudUrl` is shown rather than hidden — this is a real Nextcloud Talk
 * room, and anyone who has connected their own Nextcloud account is better
 * served by Talk's own client (calls, files, mentions) than by this view.
 */
export function ChatPage({
  messages,
  canPost,
  roomName,
  nextcloudUrl,
  endpoint,
  identity,
  identityEndpoint,
}: {
  messages: OrgChatMessage[];
  canPost: boolean;
  /** The name this viewer posts under; renders the "Posting as" control. */
  identity?: OrgChatIdentity;
  identityEndpoint?: string;
  /** Where this app mounted the chat API, if not /api/chat/messages. */
  endpoint?: string;
  /** The room's name in Nextcloud, so nobody wonders which room this is. */
  roomName: string | null;
  nextcloudUrl: string | null;
}) {
  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-96 flex-col">
      <ChatTranscript
        initialMessages={messages}
        canPost={canPost}
        endpoint={endpoint}
        identity={identity}
        identityEndpoint={identityEndpoint}
        pollMs={4000}
        className="flex-1 rounded-lg border bg-card p-4"
      />
      {(roomName || nextcloudUrl) && (
        <p className="mt-3 shrink-0 text-xs text-muted-foreground">
          {roomName && <>This is the group&rsquo;s Nextcloud Talk room, {roomName}. </>}
          {nextcloudUrl && (
            <a href={nextcloudUrl} className="underline" target="_blank" rel="noreferrer">
              Open it in Nextcloud
            </a>
          )}
          {nextcloudUrl && " if you have an account there."}
        </p>
      )}
    </div>
  );
}
