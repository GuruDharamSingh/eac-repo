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
    <article className="content-page content-page--wide">
      <h1 className="page-title">Navigation</h1>
      <p>
        The links down the side of every page. Pages built in the editor answer
        at their own address — a page published as <code>about</code> is at{" "}
        <code>/about</code> — so anything listed here can point straight at one.
      </p>
      <div style={{ marginTop: "2rem" }}>
        <NavEditor initial={nav} candidates={candidates} onSave={saveNavAction} />
      </div>
    </article>
  );
}
