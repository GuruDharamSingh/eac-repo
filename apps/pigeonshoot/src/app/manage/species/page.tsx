import type { Metadata } from "next";
import { SpeciesManager } from "@/components/manage/species-manager";
import { listAllSpecies, listProposedOnCards } from "@/lib/manage/data";

export const metadata: Metadata = { title: "Species" };

export default async function ManageSpeciesPage() {
  const [species, proposals] = await Promise.all([listAllSpecies(), listProposedOnCards()]);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Species</h1>
      <SpeciesManager species={species} proposals={proposals} />
    </div>
  );
}
