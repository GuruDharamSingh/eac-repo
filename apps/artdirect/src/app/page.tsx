import { listDossiers, listDirectoryFacets } from "@/lib/oad";
import type { EntityType } from "@elkdonis/services";
import { DirectoryShell } from "@/components/shell/DirectoryShell";
import { DirectoryPage } from "@/sections/directory-page";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ region?: string; entity?: string }> };

export default async function ArtDirectHome({ searchParams }: Props) {
  const { region, entity } = await searchParams;
  const entityType: EntityType | undefined = entity === "organization" ? "organization" : entity === "person" ? "person" : undefined;
  const [dossiers, facets] = await Promise.all([listDossiers({ region, entityType }), listDirectoryFacets()]);

  return (
    <DirectoryShell current={entityType ?? "all"}>
      <DirectoryPage data={{ dossiers, facets, region, entityType }} />
    </DirectoryShell>
  );
}
