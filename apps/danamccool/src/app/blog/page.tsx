import { notFound } from "next/navigation";
import { listWriting } from "@elkdonis/services";
import { WritingShelf, StartPiece } from "@elkdonis/cms-ui/writing";
import { blogContext } from "@/lib/writing";
import { startPieceAction } from "@/lib/writing-actions";

// ============================================================================
// /blog — her writing, as a shelf. Each piece opens at /blog/<slug>.
//
// The same shelf IFAC's profile pages use (@elkdonis/cms-ui/writing), so a
// piece looks like one publication wherever it is read. Signed in as Dana,
// the shelf shows her drafts and a one-field "start a piece" — writing happens
// in place, on the piece's own page, without opening the page editor.
//
// Every piece she writes is listed, wherever she wrote it: this is her site.
// ============================================================================

export const dynamic = "force-dynamic";
export const metadata = { title: "Writing" };

export default async function BlogPage() {
  const { authorId, canWrite } = await blogContext();
  if (!authorId) notFound();
  const items = await listWriting(authorId, { includeDrafts: canWrite });

  return (
    <div className="dm-blog">
      <WritingShelf
        items={items}
        basePath="/blog"
        heading="Writing"
        kicker="Dana McCool"
        showDrafts={canWrite}
        emptyNote={
          canWrite ? "Nothing here yet. Start below — a piece stays a draft until you publish it." : "Nothing published yet."
        }
      >
        {canWrite ? <StartPiece onCreate={startPieceAction} basePath="/blog" /> : null}
      </WritingShelf>
    </div>
  );
}
