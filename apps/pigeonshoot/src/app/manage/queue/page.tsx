import type { Metadata } from "next";
import { RatingPanel } from "@/components/manage/rating-panel";
import { listCriteria, listTiers } from "@/lib/data";
import { listRatingQueue } from "@/lib/manage/data";

export const metadata: Metadata = { title: "Rating queue" };

export default async function QueuePage() {
  const [cards, criteria, tiers] = await Promise.all([
    listRatingQueue(),
    listCriteria(),
    listTiers(),
  ]);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Rating queue</h1>
      <RatingPanel cards={cards} criteria={criteria} tiers={tiers} />
    </div>
  );
}
