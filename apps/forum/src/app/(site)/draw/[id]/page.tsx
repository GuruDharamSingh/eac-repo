import { notFound, redirect } from "next/navigation";
import { canEditDrawing, getDrawing } from "@elkdonis/services";
import { DrawingEditor } from "@/components/DrawingEditor";
import { getViewer } from "@/lib/viewer";
import { hrefs } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Edit a drawing — its author, or someone who moderates the org. */
export default async function EditDrawingPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  const drawing = await getDrawing(id);
  if (!drawing) notFound();
  if (!viewer.userId) redirect(`/login?next=${encodeURIComponent(`/draw/${id}`)}`);
  const back = hrefs.thread(drawing.id, drawing.slug);
  if (!canEditDrawing(viewer, drawing)) redirect(`${back}?error=${encodeURIComponent("Only its author or a moderator can edit this drawing.")}`);

  return (
    <div className="gf-draw-page">
      <header className="gf-pagehead">
        <div className="gf-pagehead-main">
          <h1 className="gf-pagetitle">Editing {drawing.title}</h1>
          <p className="gf-pagesub">Saving replaces the picture everyone sees; the drawing stays editable here.</p>
        </div>
      </header>
      <DrawingEditor
        mode="edit"
        id={drawing.id}
        initialTitle={drawing.title}
        initialCaption={drawing.caption ?? ""}
        initialScene={drawing.scene}
        targets={[]}
        cancelHref={back}
      />
    </div>
  );
}
