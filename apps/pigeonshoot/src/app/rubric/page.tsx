import type { Metadata } from "next";
import { Bot, User, Crown } from "lucide-react";
import { getSiteSections, listCriteria, listTiers } from "@/lib/data";

export const metadata: Metadata = {
  title: "What makes a good card",
  description: "The rubric cards are rated against. It changes.",
};

const SOURCE_META = {
  auto: {
    icon: Bot,
    label: "Checked automatically",
    note: "Measured from your photos when you upload them.",
  },
  submitter: {
    icon: User,
    label: "You tick these",
    note: "Claims, not scores — the owner confirms or rejects each one.",
  },
  owner: {
    icon: Crown,
    label: "The owner's call",
    note: "Unquantifiable. Only the project owner can award these.",
  },
} as const;

/**
 * The rubric, rendered live from the database.
 *
 * This page has no hardcoded criteria in it on purpose: the rubric is rows in
 * pigeon_criteria, so editing it at /manage/rubric changes what contributors
 * read here as well as what they're scored against. The two can't drift.
 */
export default async function RubricPage() {
  const [criteria, tiers, sections] = await Promise.all([
    listCriteria(),
    listTiers(),
    getSiteSections(),
  ]);

  const copy = sections.rules ?? {};
  const grouped = (["auto", "submitter", "owner"] as const).map((source) => ({
    source,
    items: criteria.filter((c) => c.source === source),
  }));
  const total = criteria.reduce((n, c) => n + c.points, 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">
        {copy.title ?? "What makes a good card"}
      </h1>
      <div
        className="mt-3 text-muted-foreground [&_p]:mt-2"
        dangerouslySetInnerHTML={{
          __html:
            copy.body ??
            "<p>The tick-boxes on the submit form are the rubric, and the rubric changes.</p>",
        }}
      />

      <p className="mt-6 text-sm text-muted-foreground">
        {total} points are available across {criteria.length} criteria.
      </p>

      {grouped.map(({ source, items }) => {
        if (items.length === 0) return null;
        const meta = SOURCE_META[source];
        const Icon = meta.icon;
        return (
          <section key={source} className="mt-10">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Icon className="size-5 text-primary" />
              {meta.label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{meta.note}</p>
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
              {items.map((c) => (
                <li key={c.key} className="flex items-start justify-between gap-4 p-4">
                  <span>
                    <span className="font-medium">{c.label}</span>
                    {c.hint && (
                      <span className="block text-sm text-muted-foreground">{c.hint}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-sm text-muted-foreground">
                    {c.points} pt{c.points === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold">Rarity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Before a card is rated it shows a provisional band from its automatic score, in
          outline. Once the owner rates it, their verdict is the rating — a high score does not
          entitle a card to a tier.
        </p>
        <ul className="mt-4 space-y-2">
          {tiers.map((t) => (
            <li
              key={t.slug}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
            >
              <span
                className="size-4 shrink-0 rounded-full"
                style={{ backgroundColor: t.accentHex }}
                aria-hidden
              />
              <span className="flex-1">
                <span className="font-medium">{t.label}</span>
                {t.blurb && (
                  <span className="block text-sm text-muted-foreground">{t.blurb}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {t.minScore}+
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
