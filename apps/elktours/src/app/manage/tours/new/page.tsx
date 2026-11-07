import { TourForm } from "@/components/manage/tour-form";
import { requireOrgEditor } from "@/lib/auth";

export default async function NewTourPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  return (
    <>
      <h2 className="font-serif text-2xl">New tour</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Save it first; stops and departures are added on the next screen.
      </p>
      <div className="mt-6">
        <TourForm />
      </div>
    </>
  );
}
