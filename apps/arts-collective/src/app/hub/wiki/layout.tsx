import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import { WikiSidebar, WikiMobileNav } from "@/components/hub/WikiSidebar";
import { listWikiPages, buildWikiTree } from "@elkdonis/services";

export const dynamic = "force-dynamic";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  const tree = buildWikiTree(await listWikiPages());

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-10">
        <aside className="hidden w-56 shrink-0 md:block">
          <WikiSidebar tree={tree} />
        </aside>
        <div className="min-w-0 flex-1">
          <WikiMobileNav tree={tree} />
          {children}
        </div>
      </div>
    </SiteShell>
  );
}
