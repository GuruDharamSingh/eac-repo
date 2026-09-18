import { NextResponse } from "next/server";
import { createDrawing, DrawingError } from "@elkdonis/services";
import { getViewer } from "@/lib/viewer";
import { hrefs, FORUM_URL } from "@/lib/site";

/** POST — a new drawing, as a post in the given category. */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  try {
    const { id, slug } = await createDrawing({
      authorId: viewer.userId,
      orgId: String(body.orgId ?? ""),
      feedSlug: String(body.feedSlug ?? ""),
      title: String(body.title ?? ""),
      caption: typeof body.caption === "string" ? body.caption : null,
      scene: body.scene,
      svg: String(body.svg ?? ""),
      fromThreadId: typeof body.from === "string" && body.from ? body.from : null,
      imageBase: FORUM_URL,
      viewer,
    });
    return NextResponse.json({ id, href: `${hrefs.thread(id, slug)}?notice=${encodeURIComponent("Drawing posted.")}` });
  } catch (err) {
    if (err instanceof DrawingError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[drawing] create:", err);
    return NextResponse.json({ error: "Couldn't save the drawing." }, { status: 500 });
  }
}
