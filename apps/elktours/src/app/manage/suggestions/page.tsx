import { SuggestionsQueue } from "@/components/manage/suggestions-queue";
import { listSuggestionsAction } from "@/lib/suggestion-actions";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Visitors' suggested spots and walks (editors; manage/layout gates the route). */
export default async function SuggestionsPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const suggestions = await listSuggestionsAction();
  return (
    <>
      <h2 className="font-serif text-2xl">Suggestions</h2>
      <div className="mt-4">
        <SuggestionsQueue suggestions={suggestions} />
      </div>
    </>
  );
}
