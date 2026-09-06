import type { Metadata } from "next";
import { RubricEditor } from "@/components/manage/rubric-editor";
import { listCriteria, listTiers } from "@/lib/data";

export const metadata: Metadata = { title: "Rubric" };

export default async function ManageRubricPage() {
  const [criteria, tiers] = await Promise.all([listCriteria(), listTiers()]);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Rubric</h1>
      <RubricEditor criteria={criteria} tiers={tiers} />
    </div>
  );
}
