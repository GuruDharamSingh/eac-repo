import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { listConversationsForUser } from "@elkdonis/messaging/queries";
import { getCurrentUserId } from "@/lib/marketplace-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Messages" };

function whoFrom(others: { displayName: string | null; email: string | null }[]): string {
  if (others.length === 0) return "Conversation";
  return others
    .map((o) => o.displayName?.trim() || o.email || "Someone")
    .join(", ");
}

export default async function MessagesPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/messages");

  const conversations = await listConversationsForUser(userId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 font-serif text-4xl tracking-tight">Messages</h1>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          No conversations yet. Message an artist from any artwork page to start
          one.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{whoFrom(c.others)}</span>
                    {c.unreadCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                        {c.unreadCount}
                      </span>
                    )}
                  </p>
                  {c.subject && (
                    <p className="truncate text-xs text-muted-foreground">
                      Re: {c.subject}
                    </p>
                  )}
                  {c.lastMessagePreview && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.lastMessageSenderId === userId ? "You: " : ""}
                      {c.lastMessagePreview}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(c.lastMessageAt).toLocaleDateString("en-CA")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
