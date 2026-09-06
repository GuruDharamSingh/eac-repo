import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PigeonCard } from "@/components/pigeon-card";
import { ShareCardButton } from "@/components/share-card-button";
import { Button } from "@/components/ui/button";
import { getCardBySlug, listTiers } from "@/lib/data";

export const metadata: Metadata = { title: "Card published" };

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** The payoff. Show them the finished thing, then get out of the way. */
export default async function SubmitDonePage({ params }: PageProps) {
  const { slug } = await params;
  const [card, tiers] = await Promise.all([getCardBySlug(slug), listTiers()]);
  if (!card) notFound();

  return (
    <div className="mx-auto max-w-lg px-5 py-14 text-center">
      <p className="text-4xl">🐦</p>
      <h1 className="mt-3 font-display text-3xl font-bold">That&apos;s a card.</h1>
      <p className="mt-2 text-muted-foreground">
        It&apos;s live now. The rating is provisional until it&apos;s looked at by a human.
      </p>

      <div className="mx-auto mt-8 max-w-[20rem]">
        <PigeonCard card={card} tiers={tiers} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ShareCardButton slug={card.slug} title={card.title} />
        <Button asChild variant="outline">
          <Link href="/submit">Add another</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/cards/${card.slug}`}>See the card page</Link>
        </Button>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Your cards are tied to this browser.{" "}
        <Link href="/login?mode=signup" className="text-primary hover:underline">
          Make an account
        </Link>{" "}
        to keep them if you clear your cookies.
      </p>
    </div>
  );
}
