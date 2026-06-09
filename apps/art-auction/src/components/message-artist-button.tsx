"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { messageArtistAction } from "@/app/messages/actions";

/**
 * "Ask the artist" entry point on an artwork page. Reveals a short composer;
 * on send it starts (or reuses) a direct thread about this piece and navigates
 * to it. Prompts sign-in when needed.
 */
export function MessageArtistButton({
  artworkId,
  artistName,
}: {
  artworkId: string;
  artistName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setPending(true);
    try {
      const res = await messageArtistAction({ artworkId, body: text });
      if (res.needsAuth) {
        router.push(`/login?next=/artworks/${artworkId}`);
        return;
      }
      if (res.ok && res.conversationId) {
        router.push(`/messages/${res.conversationId}`);
      } else {
        toast.error(res.error ?? "Could not send your message.");
      }
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium underline underline-offset-4 hover:no-underline"
      >
        Ask {artistName?.trim() || "the artist"} a question
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-2 text-sm font-medium">
        Message {artistName?.trim() || "the artist"}
      </p>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Ask about availability, shipping, commissions…"
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim()}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
