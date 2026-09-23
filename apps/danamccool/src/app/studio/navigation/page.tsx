import { requireOrgEditor } from "@/lib/auth";
import { loadNav, editorPages } from "@/lib/navigation-store";
import { saveNavAction } from "@/lib/navigation-actions";
import { NavEditor } from "@/components/studio/nav-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Navigation" };

export default async function NavigationPage() {
  await requireOrgEditor("/studio/navigation");
  const [nav, candidates] = await Promise.all([loadNav(), editorPages()]);

  return (
    <article className="content-page content-page--wide" style={{ maxWidth: 760 }}>
      <h1 className="page-title">Navigation</h1>
      <p>
        The menu down the side of every page — its titles, their order, and where each goes. Pages built in the editor answer
        at their own address: a page published as <code>about</code> is at <code>/about</code>. The same list is in the page
        editor, under the Menu tab.
      </p>
      <div style={{ marginTop: "1.5rem" }}>
        <NavEditor initial={nav} candidates={candidates} onSave={saveNavAction} />
      </div>
    </article>
  );
}
