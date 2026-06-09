import { notFound } from "next/navigation";
import { SilexSiteBySlug } from "@elkdonis/silex-render";
import { AuthNav } from "@/components/auth-nav";
import { ORG_SLUG } from "@/lib/session";

// The published pages seeded into Nextcloud (besides index → "/").
const PAGES = new Set([
  "introduction",
  "centers",
  "triads",
  "services",
  "contact",
  "type-1",
  "type-2",
  "type-3",
  "type-4",
  "type-5",
  "type-6",
  "type-7",
  "type-8",
  "type-9",
]);

export const dynamic = "force-dynamic";

export default async function SitePage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (!PAGES.has(page)) notFound();

  return (
    <>
      <AuthNav />
      <SilexSiteBySlug
        slug={ORG_SLUG}
        page={page}
        cssLinks={["/api/silex/templates/enneagram.css"]}
      />
    </>
  );
}
