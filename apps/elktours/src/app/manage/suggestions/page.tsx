import Link from "next/link";
import { LeadsQueue, SuggestionsQueue } from "@/components/manage/suggestions-queue";
import { listLeadSuggestionsAction, listSuggestionsAction } from "@/lib/suggestion-actions";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Visitors' suggested spots and walks (editors; manage/layout gates the route). */
export default async function SuggestionsPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const [suggestions, leads] = await Promise.all([listSuggestionsAction(), listLeadSuggestionsAction()]);
  return (
    <>
      <h2 className="font-serif text-2xl">Suggestions</h2>
      <div className="mt-4">
        <SuggestionsQueue suggestions={suggestions} />
      </div>
      <h2 className="mt-12 font-serif text-2xl">Artist and place leads</h2>
      <div className="mt-4">
        <LeadsQueue leads={leads} />
      </div>
      {/* Phone only: the review lists and the share form (G7b). */}
      <nav className="mt-10 flex flex-wrap gap-2 md:hidden" aria-label="More for the office">
        <Link href="/manage/feed-review" className="border border-border px-4 py-2 text-sm">Posts to confirm</Link>
        <Link href="/manage/share" className="border border-border px-4 py-2 text-sm">Share a post or a link</Link>
        <Link href="/manage/invitations" className="border border-border px-4 py-2 text-sm">Invitations</Link>
      </nav>
    </>
  );
}
