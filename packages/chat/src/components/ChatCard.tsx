"use client";

import Link from "next/link";
import { MessageSquare, Maximize2, ExternalLink } from "lucide-react";
import type { OrgChatIdentity, OrgChatMessage } from "@elkdonis/services";
import { ChatTranscript } from "./ChatTranscript";

/**
 * The hub's compact General Chat card: sits in the tile grid, shows the last
 * few messages, and can be posted to without leaving the page. Expanding goes
 * to the full-height page rather than a modal — a chat you can link to and
 * come back to is worth more than one that traps you in a dialog.
 */
export function ChatCard({
  messages,
  canPost,
  expandedHref = "/hub/chat",
  title = "General Chat",
  endpoint,
  identity,
  identityEndpoint,
  heightClass = "h-80",
  nextcloudUrl,
}: {
  messages: OrgChatMessage[];
  canPost: boolean;
  /** The name this viewer posts under; renders the "Posting as" control. */
  identity?: OrgChatIdentity;
  identityEndpoint?: string;
  /** Where this app mounted the chat API, if not /api/chat/messages. */
  endpoint?: string;
  expandedHref?: string;
  title?: string;
  /**
   * How tall the card stands. Defaults to `h-80`, which is one tile in a face
   * grid; a host placing the chat beside or below the grid passes something
   * taller (IFAC's runs the depth of two tiles under the cards). It has to be
   * a fixed height of some kind — the transcript scrolls inside it, so `auto`
   * would let the column grow with the conversation instead.
   */
  heightClass?: string;
  /**
   * The room in Nextcloud Talk. Shown as a second, clearly separate control:
   * this transcript is a mirror read over a service account, so voice, video,
   * screen-share and files all live there and nowhere here. A member who wants
   * to actually MEET needs the door to it, and hiding that behind "expand"
   * — which only opens a bigger copy of the same mirror — is the wrong
   * promise.
   */
  nextcloudUrl?: string | null;
}) {
  return (
    <section
      aria-label={title}
      className={`flex w-full flex-col rounded-lg border bg-card p-3 ${heightClass}`}
    >
      <header className="mb-2 flex shrink-0 items-center gap-2">
        <MessageSquare className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto flex items-center gap-3">
          {nextcloudUrl && (
            <a
              href={nextcloudUrl}
              target="_blank"
              rel="noreferrer"
              // Titled rather than icon-only-and-unexplained: the difference
              // between "bigger transcript" and "the actual room" is the whole
              // point of there being two controls.
              title="Open the room in Nextcloud Talk — voice, video and files"
              aria-label="Open the room in Nextcloud Talk"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
          <Link
            href={expandedHref}
            aria-label={`Open ${title} full screen`}
            className="text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="size-4" />
          </Link>
        </span>
      </header>

      <ChatTranscript
        initialMessages={messages}
        canPost={canPost}
        endpoint={endpoint}
        identity={identity}
        identityEndpoint={identityEndpoint}
        className="flex-1"
        emptyHint="No messages yet."
      />
    </section>
  );
}
