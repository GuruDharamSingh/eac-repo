import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { getOrgBySlug, getThreadWithWorkshopPage, isOrgOwner } from "@/lib/org";
import { renderWorkshopTemplate, readWorkshopCss } from "@/lib/cms/workshop-render";
import { workshopFieldDefs, workshopCssVarDefs } from "@elkdonis/cms-bindings";
import { WorkshopLiveEditor } from "@/components/WorkshopLiveEditor";

export const dynamic = "force-dynamic";

export default async function ContentSlugPage({
  params,
}: {
  params: Promise<{ slug: string; contentSlug: string }>;
}) {
  const { slug, contentSlug } = await params;

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const workshopData = await getThreadWithWorkshopPage(org.id, contentSlug);
  if (!workshopData) notFound();

  const user = await getCurrentUser();
  const isOwner = user ? await isOrgOwner(user.id, org.id) : false;

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const rootHost = host.replace(new RegExp(`^${slug}\\.`), "");

  const css = readWorkshopCss();
  const html = renderWorkshopTemplate(workshopData);

  // Server-side theme override CSS injection (avoids flash on load)
  const themeOverrides = workshopData.theme_overrides ?? {};
  const themeOverrideCss =
    Object.keys(themeOverrides).length > 0
      ? `:root {\n${Object.entries(themeOverrides)
          .map(([k, v]) => `  ${k}: ${v};`)
          .join("\n")}\n}`
      : null;

  const hubUrl = `${proto}://${rootHost}/hub/workshops/${slug}/${workshopData.id}`;

  // Build editor config server-side — serialised to client as props
  const fields = isOwner ? workshopFieldDefs(workshopData) : [];
  const cssVars = isOwner ? workshopCssVarDefs() : [];

  return (
    // position:relative so absolute-positioned edit pins align to page scroll
    <div style={{ position: "relative" }}>
      <style
        // biome-ignore lint: workshop template CSS is trusted static content
        dangerouslySetInnerHTML={{ __html: css }}
      />
      {themeOverrideCss && (
        <style
          // biome-ignore lint: owner-defined CSS var values
          dangerouslySetInnerHTML={{ __html: themeOverrideCss }}
        />
      )}

      {isOwner && (
        <WorkshopLiveEditor
          threadId={workshopData.id}
          hubUrl={hubUrl}
          fields={fields}
          cssVars={cssVars}
          cssOverrides={themeOverrides}
        />
      )}

      <div
        className="eac-ws-page"
        // biome-ignore lint: workshop template HTML is sanitized server-side
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
