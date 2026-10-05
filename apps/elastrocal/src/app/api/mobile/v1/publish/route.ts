import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { randomBytes } from "node:crypto";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Publishing an episode from the app to YouTube, through the same queue and
 * worker as the Akhand Path (video_uploads, migration 193; the video-worker
 * uploads queued rows with the connection's refresh token).
 *
 * POST { path, title, description?, privacy?, episodeId? }
 *   path: the org-relative file from /api/mobile/v1/media. The channel is the
 *   caller's own connected YouTube connection (user_connections, 192): only
 *   the person who connected a channel can publish to it. Pressing Publish in
 *   the app is the review, so the row goes in as 'queued'. Owners only.
 *   An unaudited Google project can only upload private videos.
 * GET → this org's uploads from the app, newest first, with status.
 */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not linked" }, { status: 401 });
  if (viewer.role !== "owner") return NextResponse.json({ error: "Owners only" }, { status: 403 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const path = typeof b?.path === "string" ? b.path : "";
  const title = typeof b?.title === "string" ? b.title.trim().slice(0, 100) : "";
  if (!path.startsWith("Private/Jerusalem/") || path.includes("..")) return NextResponse.json({ error: "Upload the video first" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
  const description = typeof b?.description === "string" ? b.description.slice(0, 5000) : "";
  const privacy = ["private", "unlisted", "public"].includes(String(b?.privacy)) ? String(b?.privacy) : "private";

  const [conn] = await db<{ id: string; account_name: string | null }[]>`
    SELECT id, account_name FROM user_connections
    WHERE user_id = ${viewer.userId} AND provider = 'youtube' AND status = 'connected'
    ORDER BY connected_at DESC NULLS LAST LIMIT 1
  `;
  if (!conn) return NextResponse.json({ error: "No connected YouTube channel on your account" }, { status: 409 });

  // Same shape as the worker's other ids (varchar 21, URL-safe).
  const id = randomBytes(16).toString("base64url").slice(0, 21);
  const rows = await db`
    INSERT INTO video_uploads (id, org_id, thread_id, connection_id, source_path, source_bytes, title, description, privacy, status, approved_by, approved_at)
    VALUES (${id}, ${siteConfig.orgId}, NULL, ${conn.id}, ${path}, ${Number(b?.bytes) || 0}, ${title}, ${description}, ${privacy}, 'queued', ${viewer.userId}, now())
    ON CONFLICT (org_id, source_path) DO NOTHING
    RETURNING id
  `;
  if (!rows.length) return NextResponse.json({ error: "That video is already queued" }, { status: 409 });
  return NextResponse.json({ id, channel: conn.account_name, status: "queued" }, { status: 201 });
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not linked" }, { status: 401 });
  if (viewer.role !== "owner") return NextResponse.json({ error: "Owners only" }, { status: 403 });
  const rows = await db<
    { id: string; source_path: string; title: string; privacy: string; status: string; youtube_video_id: string | null; error: string | null; uploaded_bytes: string; source_bytes: string; created_at: Date; published_at: Date | null }[]
  >`
    SELECT id, source_path, title, privacy, status, youtube_video_id, error, uploaded_bytes, source_bytes, created_at, published_at
    FROM video_uploads WHERE org_id = ${siteConfig.orgId} AND source_path LIKE 'Private/Jerusalem/%'
    ORDER BY created_at DESC LIMIT 50
  `;
  return NextResponse.json({
    uploads: rows.map((r) => ({
      id: r.id,
      path: r.source_path,
      title: r.title,
      privacy: r.privacy,
      status: r.status,
      url: r.youtube_video_id ? `https://youtu.be/${r.youtube_video_id}` : null,
      error: r.error,
      progress: Number(r.source_bytes) > 0 ? Number(r.uploaded_bytes) / Number(r.source_bytes) : null,
      createdAt: r.created_at.toISOString(),
      publishedAt: r.published_at?.toISOString() ?? null,
    })),
  });
}
