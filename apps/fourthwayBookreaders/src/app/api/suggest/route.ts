import { NextResponse } from "next/server";
import { createOrgIdea, ensureIdeasFeed } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Suggest a book. Filed as an `idea` thread through the shared createOrgIdea,
 * so it shows up wherever the network already lists ideas (the hub's ideas
 * face, when this site grows one) instead of in a table only this app reads.
 *
 * Sign-in is required: createOrgIdea needs an author, and anonymous posting
 * does not work anywhere on the network yet (users.auth_user_id is NOT NULL).
 * Any signed-in person may suggest — a follower's suggestion is the point.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to suggest a book" }, { status: 401 });

  const data = await request.json().catch(() => null) as
    | { title?: unknown; author?: unknown; why?: unknown; mode?: unknown }
    | null;
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const author = typeof data?.author === "string" ? data.author.trim().slice(0, 160) : "";
  const why = typeof data?.why === "string" ? data.why.trim().slice(0, 2000) : "";
  // Two things arrive here: a book, or an offer to host. Same destination (the
  // circle's ideas), but labelled, so an editor never reads "my living room,
  // Tuesdays" as a title to go and find.
  const hosting = data?.mode === "host";
  if (title.length < 3) {
    return NextResponse.json(
      { error: hosting ? "Say where or how you could host" : "Give the book's title" },
      { status: 400 }
    );
  }

  await ensureIdeasFeed(siteConfig.orgId, "Suggested books");
  const idea = await createOrgIdea(siteConfig.orgId, {
    authorId: viewer.userId,
    title: hosting ? `Hosting offer: ${title}` : author ? `${title} — ${author}` : title,
    // Plain text in, plain text out: escape before it becomes a thread body.
    body: why ? `<p>${why.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : undefined,
  });
  if (!idea) return NextResponse.json({ error: "Could not save that" }, { status: 500 });
  return NextResponse.json({ ok: true, id: idea.id });
}
