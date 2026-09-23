# News aggregation — groundwork

**Status:** design note. Nothing here is built. Written 2026-09-05 alongside the
three-page org subdomain, whose `/community` page currently renders the
network-wide newsroom and is the surface this would eventually feed.

## What we're actually trying to make

Not a feed reader. The goal is a **per-org view of the scene that org is in** —
other orgs, artists, shows and writing near it in *place* and in *field* (music,
painting, crafting, social practice). An org can suggest additions and veto what
appears on its own page; final say over what circulates sits with collective
staff. The unified network newsroom shipped now is the degenerate case of that:
everyone's scene is "the whole collective" until there's enough material to
narrow it.

That ordering matters. A per-org scene page is only worth building once there is
more content than one org produces, and the aggregator is how that content
arrives.

## Where content comes from

Three sources, in the order they're worth building:

1. **The network itself.** Threads already in `threads` across every org. Free —
   no ingestion, no trust problem, already public. This is what `/community`
   renders today.
2. **Feeds.** RSS/Atom from orgs' own sites, members' blogs, and friendly
   publications. Cheap, well-understood, and the source most likely to keep
   producing without anyone tending it.
3. **Submitted links.** A person pastes a URL. Highest value per item and the
   only one that needs real moderation, because it's the only one where the
   submitter chose the item rather than a publisher choosing it.

## Ingestion

**Feeds.** Poll on a schedule, per feed. Send `If-None-Match` / `If-Modified-Since`
from the stored `etag` / `last_modified` and skip the body entirely on `304` —
this is the single biggest reduction in both bandwidth and duplicate work, and
it's a property of the HTTP layer, not the parser. Back off a feed that errors
repeatedly rather than hammering it.

**Submitted links.** Fetch once at submission time to resolve and describe the
item, then treat it exactly like a feed item from there on.

**Resolution, both paths.** Follow redirects to the end and store the *final*
URL; feed items frequently point at trackers and aggregator shims (Google News
being the notorious case) and the pre-redirect URL is useless for both dedup and
attribution. Strip known tracking params (`utm_*`, `fbclid`, …) and normalise
scheme, host case, and trailing slash before the URL is used as a key.

## Deduplication

The same story arrives repeatedly — from a feed that republishes, from two
people submitting it, from an org and a member both posting it. Three layers,
cheapest first:

1. **Canonical URL.** Exact match on the normalised, redirect-resolved URL.
   Catches most of it.
2. **Title + origin.** Same title from the same host is the same item even when
   the URL gained a parameter.
3. **Content hash.** SHA-256 over normalised (title + publish date + link).
   Store it; reject on collision. Cheap and catches feeds that mint a fresh GUID
   per poll — the classic cause of a feed that "repeats itself" forever.

Deliberately *not* near-duplicate clustering (many outlets covering one event,
grouped with a representative chosen). That's the hard part of a general news
aggregator and it is not our problem at our scale: we are not ingesting 200
outlets' coverage of an earthquake. Revisit only if the same story genuinely
starts arriving from many sources.

## Ranking

The scene page should feel current without being amnesiac. The standard shape —
score decaying with age, votes lifting it — is the right starting point:

```
score = (votes - 1) / (hours_since + 2)^gravity      # gravity ≈ 1.8
```

Two adjustments for our case: our vote volume is tiny, so weight **freshness and
proximity** (same city, same field) more heavily than votes, and let a staff
"lift" flag override the maths outright for something that matters. Resist
personalisation; it's a lot of machinery to make a small community's front page
worse.

## Moderation — the part with a working precedent

Submitted links need review, and the repo already has the flow this should copy:
`questionnaire_responses` moves `draft → submitted → reviewed | returned` with
`reviewed_by`, `reviewed_at` and `review_note`, queued for staff in
`/hub/admin/vetting` (`packages/services/src/questionnaires.ts`, ~line 254).
Same states, same reviewer columns, same queue shape.

Two review surfaces, because there are two different questions:

- **Staff (network-wide):** does this belong on the platform at all? The
  `submitted → reviewed` gate.
- **Org (their page only):** does this belong on *our* scene page? A veto, and a
  suggestion channel back to staff. An org can hide something from its own page
  without removing it from the network — which is exactly the "may veto or
  suggest, doesn't have ultimate control" split.

`moderation_log` and `packages/db/src/events.ts` (`Events.log`, `hideContent`,
`overrideVisibility`) already exist for the audit trail; a veto should write
there rather than inventing a parallel history.

## Schema sketch

```
news_source     id, kind ('feed'|'submission'|'network'), url, title,
                org_id?, etag, last_modified, last_fetched_at,
                failure_count, active

news_item       id, source_id, canonical_url (unique), content_hash (unique),
                title, excerpt, author, image_url, published_at,
                fetched_at, status ('submitted'|'reviewed'|'returned'|'hidden'),
                reviewed_by, reviewed_at, review_note,
                submitted_by, lift (bool), score

news_item_tag   item_id, tag            -- field: music, painting, …
news_item_place item_id, city, region, country, lat, lng

org_news_veto   org_id, item_id, vetoed_by, vetoed_at, reason
```

`news_item.status` mirrors the questionnaire vocabulary on purpose. Place and
field are separate tables rather than columns because an item can plausibly be
in several of each, and because "near this org, in its field" is the query the
whole feature exists to answer.

## What to build first

1. **Feed ingestion for orgs' own domains.** amrit-canada, ifac,
   hidden-enneagram and inner-gathering all run real sites. Ingesting their
   feeds proves the whole path — poll, resolve, dedup, store — against content
   we already trust, with no moderation question to answer yet.
2. **The scene query.** `org → items near it in place and field`, rendered as a
   narrowed `/community`. Needs org location and field, which orgs can now hold
   on their own identity row (migration 099) but which nothing populates yet —
   that gap is the real prerequisite.
3. **Submissions + the staff queue**, on the questionnaire pattern.
4. **Org veto**, last, once there is enough on a page for an org to want to
   remove something from it.

## Open questions

- Where does ingestion run? There's no job runner in this repo — a scheduled
  container, a cron on the host, or Next route handlers hit by cron are all
  plausible and none is established.
- Do we store article text, or only metadata plus a link? Metadata-only is
  lighter and avoids a republishing question we don't need to have.
- Should a member's own blog be a `news_source` or should they post threads?
  Both work; the answer decides whether the aggregator is mainly external-facing.

## Sources

- [A better ranking algorithm — Herman's blog](https://herman.bearblog.dev/a-better-ranking-algorithm/)
- [Ranking algorithms on social news aggregators](https://coderwall.com/p/cacyhw/an-introduction-to-ranking-algorithms-seen-on-social-news-aggregators)
- [News aggregator system design — dedup and ranking](https://crackingwalnuts.com/post/news-aggregator-system-design)
- [Google News system design](https://www.systemdesignhandbook.com/guides/google-news-system-design/)
- [RSS feed deduplication methods](https://lifetips.alibaba.com/tech-efficiency/call-for-help-stop-repeating-rss-feed-items)
- [Google News RSS: how it works and its limits](https://cloro.dev/blog/google-news-rss/)
