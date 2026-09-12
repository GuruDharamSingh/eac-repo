import Link from "next/link";
import { SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import { ProfileCardBody } from "@elkdonis/cms-ui/center";
import type { OrgProfile, ServiceOffering } from "@elkdonis/services";
import { priceLabel } from "@/lib/services";
import "./center-strip.css";

/**
 * The digest under the chart: who is here, what they offer, where to talk.
 *
 * The same idea as /center on amrit-canada — an org's console rendered as a
 * row of faces — but Elastrocal has almost none of the tables /center reads
 * (no threads, no Talk room), so this is the honest subset rather than a
 * CenterPage with five empty regions. Every card that has real content is
 * live; the rest say plainly that they are not built yet instead of opening
 * an empty panel. That is the hub-cards posture from the brief: a feature
 * with no data shows as unavailable, never as a dead link.
 *
 * As the tables fill (a Talk room for the org, posts, a forum) the matching
 * card swaps from `muted` to a real target without the section changing
 * shape — and if it grows past that, this becomes a call to CenterPage.
 */

export interface CenterStripData {
  people: OrgProfile[];
  services: ServiceOffering[];
  /** Other sites in the network, for the last card. */
  sites: Array<{ orgName: string; url: string }>;
  viewer: { signedIn: boolean; displayName: string | null; avatarUrl: string | null } | null;
  forumUrl: string | null;
}

export function CenterStrip({ data }: { data: CenterStripData }) {
  const { people, services, sites, viewer, forumUrl } = data;
  const published = services.filter((s) => s.status === "published");

  return (
    <section className="mt-14 border-t border-border pt-10">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">The collective</h2>
        <p className="text-sm text-muted-foreground">
          Readings, people and the wider network behind this chart.
        </p>
      </header>

      <SurfaceCardGrid>
        {/* The people who keep this place — Guru Dharam Singh first, as owner. */}
        {people.map((p) => (
          <SurfaceCard
            key={p.userId}
            kind="neutral"
            glyph="◯"
            // The portrait's own bar carries the name, so the card's title
            // says what the card DOES instead of repeating it.
            kicker={p.roleTitle ?? "Astrologer"}
            title="Profile"
            blurb={p.headline ?? undefined}
            href={p.slug ? `/people/${p.slug}` : "/people"}
            className="group eac-center-person el-person"
            ariaLabel={`${p.displayName}’s profile`}
            preview={
              <ProfileCardBody
                image={p.avatarUrl}
                glyph="◯"
                name={p.displayName}
                subtitle={p.headline ?? p.roleTitle}
                note={p.city}
                links={p.socialLinks.map((l) => ({ label: l.label ?? null, url: l.url }))}
              />
            }
          />
        ))}

        {/* Readings. One card for the lot; the page behind it lists them. */}
        <SurfaceCard
          kind="service"
          glyph="✦"
          kicker="Readings"
          title={published.length > 0 ? "Book a reading" : "Readings"}
          blurb={
            published.length > 0
              ? published
                  .slice(0, 3)
                  .map((s) => s.title)
                  .join(" · ")
              : "Nothing listed yet — readings will appear here when they open."
          }
          href={published.length > 0 ? "/services" : undefined}
          disabled={published.length === 0}
          cue={published.length > 0 ? "→" : undefined}
          preview={
            published.length > 0 ? (
              <ul className="space-y-1.5 pt-6 text-sm">
                {published.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{s.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {priceLabel(s.price, s.currency, s.priceSlidingMin) ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : undefined
          }
        />

        {/* Your own charts — the one card that changes with signing in. */}
        <SurfaceCard
          kind="post"
          glyph="☍"
          kicker={viewer?.signedIn ? "You" : "Your charts"}
          title={viewer?.signedIn ? (viewer.displayName ?? "Your charts") : "Chart your own"}
          blurb={
            viewer?.signedIn
              ? "The charts you have saved, and a new one whenever you want it."
              : "Cast a birth chart now — no account needed. Sign in later to keep them."
          }
          href="/charts"
          cue="→"
        />

        {/* Ask. Elastrocal has no board of its own; the network forum is
            where a question goes, so the card points there rather than
            pretending to a local one. */}
        <SurfaceCard
          kind="forum"
          glyph="✎"
          kicker="Ask"
          title="Questions"
          blurb={
            forumUrl
              ? "Ask about a placement, a house system, or what the wheel is showing."
              : "A place to ask about a chart. Not open yet."
          }
          href={forumUrl ?? undefined}
          disabled={!forumUrl}
          cue={forumUrl ? "→" : undefined}
        />

        {/* Talk. No room for this org yet, so the card is honest about it. */}
        <SurfaceCard
          kind="meeting"
          glyph="◇"
          kicker="Talk"
          title="Messages"
          blurb="Direct conversation with the astrologer. Not open yet."
          disabled
        />

        {/* Around the network. */}
        {sites.length > 0 && (
          <SurfaceCard
            kind="gallery"
            glyph="◈"
            kicker="Around the network"
            title="Other sites"
            blurb="Elastrocal is one of several sites in the Elkdonis Arts Collective."
            preview={
              <ul className="space-y-1.5 pt-6 text-sm">
                {sites.slice(0, 5).map((s) => (
                  <li key={s.url} className="truncate">
                    <span className="text-muted-foreground">→ </span>
                    {s.orgName}
                  </li>
                ))}
              </ul>
            }
            href={sites[0].url}
            cue="→"
          />
        )}
      </SurfaceCardGrid>

      <p className="mt-5 text-sm text-muted-foreground">
        <Link href="/people" className="text-primary underline underline-offset-4">
          Everyone here
        </Link>
      </p>
    </section>
  );
}
