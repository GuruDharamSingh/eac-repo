"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import type { OrgChatIdentity, OrgChatMessage } from "@elkdonis/services";
import { ChatIdentity } from "./ChatIdentity";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";

/**
 * The chat itself: transcript plus composer, shared by the hub's compact card
 * and the full page. Both render the same room and the same messages; only the
 * height and how much surrounding furniture they show differ.
 *
 * Polling, not sockets. Talk's live channel needs either a long-poll held open
 * per viewer or the notify_push service, and a hub card sitting idle in a tab
 * is the common case — a short poll while the tab is visible costs less and
 * fails more gracefully. Each poll re-reads the recent window and merges by
 * message id, so a message that arrives twice lands once.
 */
export function ChatTranscript({
  initialMessages,
  canPost,
  pollMs = 6000,
  className,
  emptyHint = "No messages yet. Say hello.",
  endpoint = "/api/chat/messages",
  identity,
  identityEndpoint,
}: {
  initialMessages: OrgChatMessage[];
  canPost: boolean;
  /** The name this viewer posts under; renders the "Posting as" control. */
  identity?: OrgChatIdentity;
  identityEndpoint?: string;
  pollMs?: number;
  className?: string;
  emptyHint?: string;
  /** Where this app mounted the chat API. The org is fixed server-side there. */
  endpoint?: string;
}) {
  const [messages, setMessages] = useState<OrgChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const merge = useCallback((incoming: OrgChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const byId = new Map<number, OrgChatMessage>(current.map((m) => [m.id, m] as const));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.id - b.id);
    });
  }, []);

  // Poll only while the tab is visible — a backgrounded hub shouldn't keep
  // asking Nextcloud for messages nobody is reading.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) return;
        const fresh: OrgChatMessage[] = await res.json();
        if (!cancelled) merge(fresh);
      } catch {
        // A dropped poll is not worth telling anyone about; the next one retries.
      }
    }

    const timer = setInterval(poll, pollMs);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [merge, pollMs, endpoint]);

  // Follow new messages, but don't yank the view down while someone is reading
  // back through the history.
  useEffect(() => {
    if (atBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages]);

  async function send() {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        setError("That message didn't send.");
        return;
      }
      merge([await res.json()]);
      setDraft("");
      atBottomRef.current = true;
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1"
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{emptyHint}</p>
        ) : (
          messages.map((m, i) => {
            if (m.isSystem) {
              return (
                <p key={m.id} className="text-center text-[11px] text-muted-foreground">
                  {m.message}
                </p>
              );
            }

            // A short message is ONE line: name, text and time all inline.
            //
            // The name used to sit on its own line above every message and the
            // time on its own line below, so a three-word message cost three
            // lines and a card-sized transcript held four of them. The name is
            // now a prefix, and only on the first message of a run by the same
            // person — a back-and-forth repeats two names down the whole
            // column otherwise.
            //
            // Your own messages carry no name at all: they are right-aligned
            // and in the accent colour, which already says whose they are.
            // (The name you post under is still shown, once, by the "Posting
            // as" control under the composer — that was the other reason it
            // was on every line.)
            const previous = messages[i - 1];
            const showName =
              !m.own && (!previous || previous.isSystem || previous.authorName !== m.authorName);

            return (
              <div key={m.id} className={cn("flex", m.own ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-md px-2 py-1 text-sm leading-snug",
                    m.own ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {/* One interpolation, not name-then-colon: two adjacent
                      children make React emit a comment node between them,
                      which lands in the middle of the name when the line is
                      copied or read aloud. */}
                  {showName && (
                    <span className="mr-1 font-medium opacity-80">{`${m.authorName}:`}</span>
                  )}
                  <span className="whitespace-pre-wrap break-words">{m.message}</span>
                  {/* Inline and last, so it fills the gap at the end of the
                      line instead of claiming one of its own. opacity-80 is
                      the floor that still measures 4.9:1 on the accent
                      bubble. */}
                  <time
                    className="ml-1.5 text-[10px] opacity-80"
                    dateTime={m.at}
                    title={new Date(m.at).toLocaleString("en-CA")}
                  >
                    {new Date(m.at).toLocaleTimeString("en-CA", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canPost && (
        <div className="mt-2 shrink-0">
          {identity && (
            <div className="mb-1.5">
              <ChatIdentity identity={identity} endpoint={identityEndpoint} />
            </div>
          )}
          {error && <p className="mb-1 text-xs text-destructive">{error}</p>}
          <div className="flex items-end gap-2">
            <Textarea
              rows={1}
              value={draft}
              placeholder="Write a message …"
              className="max-h-32 min-h-9 resize-none py-2"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — as Talk does.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              size="icon"
              aria-label="Send message"
              disabled={sending || !draft.trim()}
              onClick={() => void send()}
            >
              <SendHorizonal className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
