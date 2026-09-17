import { requireOrgEditor } from "@/lib/auth";
import { loadPalette } from "@/lib/theme-store";
import { savePaletteAction } from "@/lib/theme-actions";
import { PaletteEditor } from "@/components/studio/palette-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Colours" };

/**
 * The site's palette.
 *
 * Gated here so nobody without the role loads the editor, and again in the
 * action — a client component is not an authorisation boundary.
 */
export default async function ThemePage() {
  await requireOrgEditor("/studio/theme");
  const palette = await loadPalette();

  return (
    <article className="content-page content-page--wide">
      <h1 className="page-title">Colours</h1>
      <p>
        One set of colours for the whole site. The sections brought in from
        outside keep their own markup and take these values, so changing a
        colour here changes every page at once.
      </p>
      <p>
        The numbers beside each pair are contrast ratios. They are the reason
        text is readable or not, and a failing pair is worth fixing before it
        ships rather than after someone writes in.
      </p>
      <div style={{ marginTop: "2rem" }}>
        <PaletteEditor initial={palette} onSave={savePaletteAction} />
      </div>
    </article>
  );
}
