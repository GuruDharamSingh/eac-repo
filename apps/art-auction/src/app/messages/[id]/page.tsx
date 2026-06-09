import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getConversationThread } from "@elkdonis/messaging/queries";
import { markConversationRead } from "@elkdonis/messaging/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { MessageComposer } from "@/components/message-composer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=/messages/${id}`);

  const thread = await getConversationThread(id, userId);
  if (!thread) notFound();

  // Reading the thread clears its unread state for this user.
  void markConversationRead({ conversationId: id, userId });

  const others = thread.participants.filter((p) => p.userId !== userId);
  const title =
    others.map((o) => o.displayName?.trim() || o.email || "Someone").join(", ") ||
    "Conversation";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col px-6 py-8">
      <header className="mb-6 border-b border-border pb-4">
        <Link
          href="/messages"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← All messages
        </Link>
        <h1 className="mt-2 font-serif text-2xl tracking-tight">{title}</h1>
        {thread.subject && (
          <p className="text-sm text-muted-foreground">Re: {thread.subject}</p>
        )}
      </header>

      <div className="flex-1 space-y-4">
        {thread.messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet — say hello.
          </p>
        ) : (
          thread.messages.map((m) => {
            const mine = m.senderId === userId;
            return (
              <div
                key={m.id}
                className={mine ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm " +
                    (mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground")
                  }
                >
                  {!mine && (
                    <p className="mb-0.5 text-xs font-medium opacity-70">
                      {m.senderName?.trim() || "Them"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={
                      "mt-1 text-right text-[10px] " +
                      (mine ? "opacity-70" : "text-muted-foreground")
                    }
                  >
                    {new Date(m.createdAt).toLocaleString("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="sticky bottom-0 mt-6 border-t border-border bg-background pt-4">
        <MessageComposer conversationId={thread.id} />
      </div>
    </main>
  );
}
