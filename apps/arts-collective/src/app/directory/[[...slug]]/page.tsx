import { redirect, permanentRedirect } from "next/navigation";

/**
 * The Online Artist Directory moved to its own app, **ArtDirect** (the OAD's
 * standalone home). Anything under /directory now redirects there, preserving
 * existing links. The directory data still lives in the same shared database
 * (`directory_profiles`, org_id='oad') — only the surface moved.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug?: string[] }> };

export default async function DirectoryRedirect({ params }: Props) {
  const { slug } = await params;
  const base = (process.env.NEXT_PUBLIC_ARTDIRECT_URL || "http://localhost:3013").replace(/\/$/, "");
  const path = slug && slug.length ? `/${slug.join("/")}` : "/";
  // External redirect to the ArtDirect app.
  if (process.env.NODE_ENV === "production") permanentRedirect(`${base}${path}`);
  redirect(`${base}${path}`);
}
