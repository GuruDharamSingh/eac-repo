import { NextResponse } from "next/server";
import { canEditDrawing, DrawingError, getDrawing, updateDrawing } from "@elkdonis/services";
import { getViewer } from "@/lib/viewer";
import { hrefs, FORUM_URL } from "@/lib/site";

/** PUT — replace a drawing's scene and picture. Author or moderator. */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const [{ id }, viewer] = await Promise.all([ctx.params, getViewer()]);
  if (!viewer.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const drawing = await getDrawing(id);
  if (!drawing) return NextResponse.json({ error: "No such drawing." }, { status: 404 });
  if (!canEditDrawing(viewer, drawing)) return NextResponse.json({ error: "Not yours to edit." }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  try {
    const r = await updateDrawing(id, {
      title: String(body.title ?? drawing.title),
      caption: typeof body.caption === "string" ? body.caption : drawing.caption,
      scene: body.scene,
      svg: String(body.svg ?? ""),
      imageBase: FORUM_URL,
    });
    return NextResponse.json({ id: r.id, href: `${hrefs.thread(r.id, r.slug)}?notice=${encodeURIComponent("Drawing saved.")}` });
  } catch (err) {
    if (err instanceof DrawingError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[drawing] update:", err);
    return NextResponse.json({ error: "Couldn't save the drawing." }, { status: 500 });
  }
}
