# Follow-up actions across channels: research findings

Prepared 2026-11-07 for the Channel product team. Covers how scheduling tools model slots, queues and follow-ups; repurposing practice; arts-sector practice; event promotion timelines; platform constraints; timing evidence; and notification practice. Method: web search (about 20 queries) and one fetch of Meta's Instagram publishing documentation. Source labels used throughout: **[doc]** vendor or platform documentation (describes behaviour of that product), **[vendor data]** a study published by a company that sells the product, **[vendor claim]** marketing assertion with no method shown, **[practitioner]** guide or anecdote by an artist, agency or arts body, **[assumed]** the author's inference, **[unverified]** could not be confirmed in this pass.

## 1. Summary

Scheduling tools share one core model: a per-account recurring weekly list of time slots, a queue that fills the earliest open slot, and a separate fixed-date path that ignores the slots (Buffer documents this precisely). None of the tools surveyed derive follow-ups from the kind of content; follow-up logic is either manual (calendar, reminders), time-based recycling of "evergreen" posts, or email automations triggered by subscriber events. Channel's idea of a per-kind template timeline is therefore a composition of existing parts, not a copy of one product. Repurposing guidance is almost entirely vendor material and says little about ordering or spacing; event promotion guidance is more consistent (announce 2 to 6 weeks out, two or three reminders, a day-of message, recording within 24 hours) but its numbers are self-reported. "Best time to post" studies disagree with each other, measure different things, and the one practitioner comparison found timing effects smaller than differences between posts; suggestions should treat timing as weak evidence and prefer the owner's own routine. Platform constraints (Instagram publishing limit and image format, no clickable caption links, Facebook preview caching, YouTube live activation delay) are firmer and should be built in as hard rules. Notification advice favours batching, per-category caps and user-set digests; the quantitative claims are vendor-sourced.

## 2. How the tools model slots, queues, recurring schedules and follow-ups

Not verified in this pass: Sprout Social, Planoly, Later and Metricool feature details beyond what is in the table; those cells say so. Entries marked [assumed] come from general knowledge of the products and should be checked before being relied on.

| Tool | Slots and queue | Recurring schedule | "Best time" | Recycling / evergreen | Follow-up and gap handling | Source |
|---|---|---|---|---|---|---|
| Buffer | Per-channel weekly posting schedule; each time added is one slot holding one post; "Next Available" takes the earliest open slot, spilling to later days. A post set to an exact date ignores the schedule and does not move when the schedule changes. Channel with no slots cannot use the queue. [doc] | Weekly pattern, per channel, per timezone. Schedule can be generated from a posting goal or from engagement data. [doc] | Own studies of millions of posts (see section 5 of this doc, timing evidence). [vendor data] | Not verified | Instagram notification-mode posts: status "Sent" means the reminder reached the phone, not that the post is live. [doc] No gap detection found. | [Buffer schedule help](https://support.buffer.com/en-us/articles/setting-up-your-timezones-and-posting-schedules-P4iSag90Fl), [Buffer IG notifications](https://support.buffer.com/articles/scheduling-instagram-posts-reels-stories-and-notifications-3XA98S9Q5p.md) |
| Typefully | Publishing queue with customisable slots; drafts can be placed in "next free slot"; the API exposes queue rules per account in local time. [third-party description of a product, doc-level for the API] | Weekly rules | Not verified | Not verified | Not verified | [comparison](https://notanothertool.pages.dev/compare/typefully-vs-metricool), [Zapier template](https://zapier.com/apps/castmagic/integrations/typefully/1761747/create-ai-content-in-castmagic-and-schedule-new-drafts-in-next-free-slot-in-typefully) |
| Hootsuite | Composer plus planner calendar; AutoSchedule picks times. [vendor claim; mechanism not published] | Not verified | "Best time to publish" heatmap per network, in Analytics and Composer; described as based on the account's own history. The algorithm is not published; the machine-learning description is from third parties. [vendor claim] | Not verified | Not verified | [Hootsuite](https://www.hootsuite.com/whats-new/best-times-to-publish-is-now-in-planner), [Hootsuite best time](https://hootsuite.com/platform/best-time-to-post-on-social-media) |
| Meta Business Suite | Planner calendar; can schedule Facebook and Instagram including Reels with restrictions. [practitioner guides; no Meta page confirmed] | n/a | "Active times" view of when the account's audience is online. [practitioner] | None | None found | [Brandwatch guide](https://www.brandwatch.com/blog/schedule-instagram-reels/) |
| Later, Planoly, Sendible, Postcron, SocialPilot (reminder mode) | For Instagram personal accounts, which cannot auto-publish, the tool sends a push or email at the scheduled time and the person finishes the post by hand. Stories and carousels sometimes only via notification. [doc, several vendors] | Visual grid planning (Planoly) [practitioner; unverified] | Not verified | Not verified | The reminder is the follow-up mechanism. | [Postcron](https://intercom.help/postcron/en/articles/7150933-how-do-instagram-reminders-work), [Sendible](https://support.sendible.com/hc/en-us/articles/211394723), [Tailwind](https://support.tailwindapp.com/en/articles/4546358-new-how-do-i-schedule-to-instagram-on-the-mobile-app) |
| SmarterQueue, ContentStudio, Bulk.ly, SocialBee (recyclers) | Category queues; posts marked evergreen are re-queued after posting; "minimum time to recycle" keeps repeats apart; SocialBee separates "evergreen" from "share once". [doc] | Per-category weekly slots | n/a | Core feature. Vendor guidance: repeat no more than about once a quarter and never two evergreen items back to back; test "still true and useful in 3 months". [vendor claim] | Re-queue is the only built-in follow-up. | [SmarterQueue](https://get-help.smarterqueue.com/article/689-recycle-evergreen-content-to-maximize-reach), [SocialBee](https://help.socialbee.com/article/73-evergreen-vs-share-once), [SocialBu](https://socialbu.com/blog/social-media-post-recycling) |
| Kit (ConvertKit) | Broadcasts (one-off sends) and sequences (timed series). "Resend to unopens" only for broadcasts, at least 1 hour after send, not for drafts or sequences; Kit advises using it sparingly. [doc] | Sequences are offset-based (days after subscription) | Not verified | Resend as a limited form | Automations triggered by subscriber events. | [Kit help](https://help.kit.com/en/articles/2502652-resending-to-unopens) |
| Beehiiv | Posts and automations (paid plans). No resend-to-unopened found; a re-engagement workflow identifies unengaged subscribers, mails a sequence, then marks inactive. [doc] | Automations | Not verified | n/a | Re-engagement is the follow-up. | [Beehiiv help](https://www.beehiiv.com/support/article/16666074781975) |
| Substack | Not verified in this pass | | | | | |
| Sprout Social, Metricool, Planoly feature detail | Not verified in this pass | | | | | |

### Patterns worth borrowing

1. **Two scheduling modes, kept visibly separate** (Buffer). A post in the queue floats with the schedule; a post with a fixed date does not. Channel already separates routine slots from dated deliveries; the Buffer behaviour is a reasonable rule for what happens when a routine changes: floating items move, pinned items stay. Event-tied follow-ups ("minus 7 days") are the pinned kind and should be anchored to the event, not to the weekly slot list.
2. **Slots are a recurring pattern, not stored instances** (Buffer). Matches the existing design where routine slots are computed at read time.
3. **Reminder mode as a first-class status** (Later, Buffer, Postcron). Where a platform cannot be written to (personal Instagram, Stories, some carousels), the honest status is "reminder sent", distinct from "published". Channel should keep the two states separate and let the owner confirm completion.
4. **Offset-based sequences with a trigger** (Kit, Beehiiv automations). A follow-up ladder is a sequence of (offset, anchor) pairs; the anchor is either the first post, the event date, or a subscriber event. This is the closest existing model to a per-kind template.
5. **Minimum spacing and category separation for repeats** (SmarterQueue, SocialBee). Useful as a rule against suggesting the same piece twice within a window or two items of the same piece back to back.
6. **Limited, explicit resend** (Kit). A single "resend to those who did not open" action, available only after an interval, framed as sparing use.
7. **Gap detection is not a standard feature.** No surveyed tool was found to flag "this piece is not on platform X". [unverified for tools not fetched] Channel's gap suggestion has no direct precedent in this sample; treat it as new to this sample, not novel in general.

## 3. Content repurposing and atomization practice

Evidence quality: almost all of it is vendor blogs and listings; none is controlled. Consistent descriptions: atomization breaks a "pillar" piece into small reusable parts (quotes, data points, frames), repurposing builds finished assets from the parts; a brief that accompanies each pillar piece maps parts to formats and channels; a repeatable workflow triggers when the pillar is published; measure which formats perform and feed back. [vendor claim] Sources did not address ordering or spacing directly; the offsets in sections 8 and 9 are therefore **[assumed]**, derived from the event timelines (section 7) and artist guidance (section 4), not from measurements. Counts such as "19 assets from one piece" are illustrative marketing.

Sources: [DashClicks](https://dashclicks.com/blog/content-atomization), [Girard Media](https://girardmedia.com/blog/content-atomization-repurposing-framework), [SocialRevver](https://www.socialrevver.com/blog/content-repurposing-framework), [PostEverywhere](https://posteverywhere.ai/social-media-terms/content-atomization).

## 4. Practice specific to artists, makers and small arts organisations

Evidence quality: [practitioner] only; arts councils, open-studio organisers and workshop leaders. None quantified.

- Open-studio and show promotion: start social announcements about six weeks out, event page on the artist's site about four weeks out, a save-the-date a month out and an announcement a week or so before; promote fellow participants' studios too. ([Louisville Visual Art timeline](https://www.louisvillevisualart.org/artist-timeline), [Devon open studios intro](https://openstudios.devonartistnetwork.co.uk/wp-content/uploads/2024/07/1-intro.pdf)).
- Many small posts with small updates beat one long post. ([Vermont Crafts seminar notes](https://www.vermontcrafts.com/wp-content/uploads/2023/03/Minutes-from-Seminar-22223.pdf)).
- Build a bank of material while making the work (photograph and film the process) to post later. ([Swindon Open Studios](https://www.swindonopenstudios.org/post/why-it-pays-to-be-social)).
- Collect a buyer's email address and add it to the mailing list; for artists not on social media, an email with a picture is the announcement. (Vermont Crafts notes, above).
- Show a work in progress at the event; go live with another artist to talk about the work and the event. ([Louisville](https://www.louisvillevisualart.org/artist-timeline)).
- Three images tend to outperform one in the cited cheat sheet. [practitioner, one source] ([River of Art](https://www.riverofart.com.au/wp-content/uploads/2024/08/2024-SOCIAL-MEDIA-CHEAT-SHEET-1.pdf)).
- Not found: published guidance with data on "sold" or "available" update cadence, studio walk-through formats, or collector-newsletter frequency for artists. Section 8 marks those rows [assumed].

## 5. Timing evidence, kept honest

| Claim | Source type | What it shows | Limit |
|---|---|---|---|
| Buffer 9.6 M Instagram posts (2026): top slots Thursday 9 am, Wednesday 12 pm and 6 pm | [vendor data](https://buffer.com/resources/when-is-the-best-time-to-post-on-instagram) | Aggregate engagement across accounts | A vendor selling scheduling; metric choice (engagement vs reach) changes the answer |
| Buffer 2 M posts (2025): 3 pm and 6 pm weekdays, using reach relative to follower count; weekends lower | [vendor data](https://buffer.com/library/best-time-to-post-on-instagram) | Same | Same |
| SocialPilot 7 M posts (2026): 7 to 9 am | [vendor data](https://www.socialpilot.co/blog/instagram/best-time-to-post-on-instagram) | Conflicts with Buffer | Different normalisation |
| Metricool about 24 M posts (2026): 8 pm weekdays | [vendor data](https://metricool.com/best-time-to-post-instagram/) | Conflicts with SocialPilot | Same |
| Practitioner: 8 am vs 8 pm of the same reel format differed under 6 percent in reach; best vs worst reel differed far more | [practitioner anecdote](https://www.lilachbullock.com/best-time-to-post-on-instagram/) | Content variation can dominate | One account, uncontrolled |
| Posting several times a day showed no negative engagement effect in 55 brands | [vendor data (Union Metrics, via secondary source)](https://www.seoinc.com/seo-blog/best-times-post-instagram/) | Frequency penalty not shown | Brands, not artists; old |
| Effect of reposting identical content | none found | Unknown | |

Reading: no peer-reviewed study was found in this pass; the vendor studies disagree by several hours. **Design implication [assumed]:** do not present a "best time" as a finding. Use the owner's own routine slots, and where a time is suggested, label it as the owner's history or as a default.

For events the data is similarly vendor-sourced: day-of registrations estimated at 14 percent (Contrast) and nearly 29 percent (Wolters Kluwer); live show-up about 47.7 percent (Livestorm via Knak); 11 percent of those who missed a live session watched the replay within 7 days (Storyblok report). See [Contrast](https://www.getcontrast.io/learn/when-to-promote-your-webinar), [Knak](https://knak.com/blog/the-different-types-of-webinar-emails/), [Wolters Kluwer](https://www.wolterskluwer.com/fr-be/expert-insights/5-simple-tips-to-increase-your-webinar-registrations), [Storyblok](https://a.storyblok.com/f/110864/x/1826cdb36a/benchmark-report-2027.pdf). Webinar data is business-to-business and may not transfer to arts events.

## 6. Platform constraints worth building in

| Platform | Constraint | Status |
|---|---|---|
| Instagram (API) | Meta's current publishing page states 100 API-published posts per 24 h moving window, carousels counting once, but a carousel section of the same page says 50. The long-cited figure is 25 (2021 launch post). Read the live value from `GET /<IG_ID>/content_publishing_limit` rather than hard-coding. Channel's brief uses 25; treat that as conservative. | **verified 2026-11-07** by fetching Meta's page; internal contradiction on the page. [Meta doc](https://developers.facebook.com/docs/instagram-platform/content-publishing), [Meta 2021 post](https://developers.facebook.com/blog/post/2021/01/26/introducing-instagram-content-publishing-api/) |
| Instagram (API) | JPEG is the only supported image format (MPO, JPS not supported). Carousel up to 20 items per the same page (an older guide says 10). | verified (Meta page) |
| Instagram | Links in captions are plain text, not tappable; tappable places are bio, Story link sticker and shopping tags. Use "link in bio" wording and a cover or card that carries the destination. | [practitioner guides](https://www.kontentino.com/q-and-a/clickable-links-instagram-captions/); Meta page does not address caption links |
| Instagram | Personal accounts cannot be auto-published by third-party tools; reminder mode only. | [doc, several tools](https://intercom.help/postcron/en/articles/7150933-how-do-instagram-reminders-work) |
| Instagram Reels | Upload length caps reported inconsistently (3 minutes in some sources, up to 20 in others, older accounts 60 or 90 seconds); rollout uneven by account. Meta's page gives no reel specs. | unverified; check per account |
| Facebook link previews | Preview built from Open Graph tags and cached; "Scrape Again" in the Sharing Debugger refreshes only new shares, not existing posts; one guide says cache lasts about 30 days. Publish the page and its image before the Facebook link post. | [practitioner](https://link.boo/guides/facebook-link-preview-not-updating), [WP Engine](https://wpengine.com/support/using-facebook-opengraph-debugger/) |
| YouTube Shorts | Square or vertical, up to 3 minutes for videos uploaded on or after 2024-10-15 (reported by guides; YouTube's own page not retrieved). | [secondary](https://piktochart.com/blog/how-long-youtube-shorts/) |
| YouTube live | First activation of live streaming can take up to 24 hours; phone verification needed. Channel's brief already notes the channel is not yet enabled. | [secondary](https://support.restream.io/en/articles/8948773-enable-live-streaming-on-youtube), [StreamElements](https://support.streamelements.com/hc/en-us/articles/23903165152914-How-to-Enable-Live-Streaming-on-YouTube) |
| Newsletters | Frequency: a 2025 e-commerce analysis found unsubscribe about 0.33 percent for twice-weekly senders and about 0.87 percent for less-than-monthly senders; MailerLite reports stable open rates from monthly to twice weekly and falling only at daily. Very infrequent mailing correlated with higher unsubscribes. | [vendor data](https://emaillistvalidation.com/blog/unsubscribe-rate-by-send-frequency-how-often-is-too-often/), [MailerLite](https://www.mailerlite.com/blog/email-frequency); commercial lists, not arts audiences |

## 7. Event and workshop promotion timelines (as published)

Consensus across vendor and practitioner guides (numbers vary; treat as directional): announce 2 to 4 weeks before for webinars, 4 to 6 weeks for open studios and shows; at least three reminders; commonly minus 1 week, minus 1 day, and a day-of or minus 1 hour message; send a recap with the recording within 24 hours, with a no-show variant; a second follow-up at about plus 3 days. Sources: [Knak](https://knak.com/blog/the-different-types-of-webinar-emails/), [Contrast](https://www.getcontrast.io/learn/when-to-promote-your-webinar), [MediaPost](https://www.mediapost.com/publications/article/321495/a-gentle-nudge-how-email-drives-webinar-attendanc.html), [aEvent checklist](https://aevent.com/?p=47123). Same-day-open "last call" is supported only by registration-timing claims that conflict (14 vs 29 percent).

## 8. Follow-up actions by content kind

Conventions. Timing is relative to the first post of the piece (+N d) or, for dated things, to the event (−N d, 0 = day). Effort: L low (minutes, no new asset), M medium (new asset from existing material), H high (new production). "Needs" is what the platform must provide. Sharing types: repost, quote card, clip, carousel, story, link post, letter mention, live, reply or thread, cross-link. **Everything in this section is [assumed]**: composed from the practices in sections 3, 4 and 7, with timings chosen to fit them. Sections 3 to 7 supply the evidence; no source gives a per-kind ladder. Needs shorthand: *card* = quote-card or image renderer; *clipper* = clip editor with overlays and captions; *nl* = newsletter queue or letter mention; *cal* = calendar anchored to a date; *reg* = registration or RSVP list; *live* = stream console; *xlink* = cross-link between pieces.

### 8.1 Artwork

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Page and shop listing published | link post anchor | Site, market | 0 | L | listing publish |
| 2 | Cover image post with "link in bio" | story/feed image | Instagram | 0 to +1 d | L | JPEG export, caption without link |
| 3 | Link post once page is live | link post | Facebook | 0 to +1 d (after page and preview image exist) | L | Open Graph tags, preview scrape |
| 4 | Detail carousel (close-ups, scale shot) | carousel | Instagram, Facebook | +2 d | M | multi-image composer |
| 5 | Studio walk-through or making clip | clip | Instagram Reels, YouTube Shorts, Facebook | +3 d | M | clipper |
| 6 | Story with price or availability sticker | story | Instagram | +5 d | L | story format; reminder mode if not writable |
| 7 | Process write-up | reply or thread / cross-link | Site, Threads | +10 d | H | writing kind, xlink to the artwork |
| 8 | Collector letter mention | letter mention | Newsletter | next issue within 30 d | L | nl |
| 9 | "Sold" or "still available" update | repost/story | Instagram, Facebook, site | on status change, or +30 d if unsold | L | status trigger from market |
| 10 | Studio live session about the piece | live | YouTube, Facebook | next open studio or +30 d | H | live |

### 8.2 Product or print

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Shop listing and product photos | link post anchor | Shop | 0 | L | listing |
| 2 | Cover post | feed image | Instagram | 0 | L | JPEG export |
| 3 | Link post | link post | Facebook | 0 to +1 d | L | OG preview |
| 4 | Packing or edition-size story | story | Instagram | +2 d | L | story |
| 5 | In-use or scale clip | clip | Reels, Shorts | +4 d | M | clipper |
| 6 | Print-run or edition quote card ("edition of 30") | quote card | Instagram, Facebook | +7 d | M | card |
| 7 | Newsletter mention in a shop roundup | letter mention | Newsletter | next issue | L | nl |
| 8 | Low stock or "last copies" | story/repost | Instagram, newsletter | when stock low (trigger) | L | stock trigger |
| 9 | Restock or reprint announcement | link post | All | on trigger | L | restock trigger |
| 10 | Cross-link to the maker's process piece | cross-link | Site | +14 d | M | xlink |

### 8.3 Writing or essay

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Publish essay page with cover | link post anchor | Site | 0 | L | publish |
| 2 | Link post with an excerpt | link post | Facebook | 0 | L | OG preview |
| 3 | Pull-quote card | quote card | Instagram | 0 to +1 d | M | card |
| 4 | Thread version (3 to 5 posts) | reply or thread | Threads | +1 d | M | thread composer |
| 5 | Second pull-quote with different passage | quote card | Instagram, Facebook | +4 d | M | card with multiple quotes per piece |
| 6 | Author reading clip | clip | Reels, Shorts | +7 d | M | clipper with subtitles |
| 7 | Letter mention | letter mention | Newsletter | next issue | L | nl |
| 8 | Reply or response piece, or reading-group discussion thread | cross-link | Site, group | +14 d | H | xlink to group |
| 9 | Re-share if still current | repost | Facebook, Threads | +60 to 90 d | L | evergreen flag, min-repeat spacing |
| 10 | Audio or live reading | live | YouTube, stream | +21 d | H | live |

### 8.4 Short video or clip

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Post natively to one lead platform | clip | Instagram Reels | 0 | L | video upload, cover frame |
| 2 | Cross-post to Shorts | clip | YouTube | 0 to +1 d | L | vertical, 3 min cap |
| 3 | Cross-post to Facebook Reels | clip | Facebook | 0 to +1 d | L | reels support |
| 4 | Site embed on the related page | cross-link | Site | 0 | L | embed |
| 5 | Still-frame card with caption | quote card | Instagram feed | +2 d | M | frame grab, card |
| 6 | Story re-share | story | Instagram | +2 d | L | story |
| 7 | Longer cut or full version | link post | YouTube, site | +7 d | H | long video kind |
| 8 | Captioned or subtitled variant | clip | All | +7 d | M | subtitles overlay |
| 9 | Letter mention | letter mention | Newsletter | next issue | L | nl |
| 10 | Behind-the-scenes follow-up | clip | Reels | +14 d | M | clipper |

### 8.5 Long video

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Publish with title, chapters, thumbnail | link post anchor | YouTube, site | 0 | M | upload, thumbnail |
| 2 | 30 to 60 s trailer clip | clip | Reels, Shorts, Facebook | 0 | M | clipper |
| 3 | Link post | link post | Facebook | 0 | L | OG |
| 4 | Pull-quote card from transcript | quote card | Instagram | +1 d | M | transcript, card |
| 5 | Three short highlight clips | clip | Reels, Shorts | +2, +5, +9 d | M | clipper with cuts, subtitles |
| 6 | Site page with transcript | cross-link | Site | +3 d | M | transcript import |
| 7 | Letter mention with a watch link | letter mention | Newsletter | next issue | L | nl |
| 8 | Written summary or essay | reply or thread / cross-link | Site | +10 d | H | writing kind |
| 9 | Behind-the-scenes still carousel | carousel | Instagram | +14 d | M | carousel |
| 10 | Live Q&A on the video | live | YouTube | +21 d | H | live |

### 8.6 Series

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Series announcement | link post | All | −21 d from first session | M | series page, cal |
| 2 | Series cover card | feed image | Instagram, Facebook | −21 d | M | card |
| 3 | Letter announcement | letter mention | Newsletter | −14 d | M | nl |
| 4 | Session-one reminder | story/post | Instagram, Facebook | −2 d | L | reminder anchored to session |
| 5 | Per-session reminder | link post | Facebook, letter | −1 d each | L | per-session anchors |
| 6 | Session recap or notes | cross-link | Site, group | +1 d each | M | recap template |
| 7 | Clip from the session | clip | Reels | +2 d each | M | clipper |
| 8 | Mid-series catch-up for latecomers | letter mention | Newsletter | halfway | L | nl |
| 9 | Last-call to join the remaining sessions | link post | All | −2 d before last open join date | L | reg |
| 10 | Series wrap-up and next-series interest list | letter mention | Newsletter | +3 d after last session | M | nl, interest list |

### 8.7 Meeting or event

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Announcement | link post | Site, Facebook, Instagram | −28 d (open studios −42 d) | M | event page, OG |
| 2 | Save-the-date in letter | letter mention | Newsletter | −28 d | L | nl |
| 3 | Details and what to expect card | quote card | Instagram | −14 d | M | card |
| 4 | Preview clip (the space, the host) | clip | Reels | −10 d | M | clipper |
| 5 | One-week reminder | link post | All | −7 d | L | cal |
| 6 | Day-before reminder with directions or join link | story/letter | Instagram, letter | −1 d | L | reg for members |
| 7 | Day-of "today" post | story | Instagram, Facebook | 0 | L | cal |
| 8 | Live or story coverage | live/story | Instagram, YouTube | 0 | M | live |
| 9 | Recap with photos | carousel | Instagram, site | +1 d | M | carousel |
| 10 | Recording or notes to members and no-shows | cross-link | Letter, site | +1 d | M | recording kind |

### 8.8 Workshop or class

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Announcement with registration link | link post | Site, Facebook | −28 d | M | reg, OG |
| 2 | Letter announcement | letter mention | Newsletter | −28 d | L | nl |
| 3 | Instructor intro clip | clip | Reels, Facebook | −21 d | M | clipper |
| 4 | Sample-work carousel | carousel | Instagram | −14 d | M | carousel |
| 5 | Seats-remaining update | story/post | Instagram, Facebook | −10 d, trigger on seats | L | seat count |
| 6 | One-week reminder to registrants | letter | Email | −7 d | L | reg |
| 7 | Last call | link post | All | −2 d | L | reg |
| 8 | Day-of material list or join link | email | Registrants | −1 d | L | reg |
| 9 | Participant work or recap | carousel | Instagram, site | +2 d | M | permission to share |
| 10 | Next-session interest and recording offer | letter mention | Newsletter | +3 d | M | nl |

### 8.9 Service (commission, consultation, tuition)

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Offering page published | link post anchor | Site | 0 | L | service kind |
| 2 | Announcement | link post | Facebook, Instagram | 0 to +1 d | L | OG |
| 3 | "How it works" carousel | carousel | Instagram | +3 d | M | carousel |
| 4 | Example outcome (before and after, finished commission) | carousel | Instagram, Facebook | +7 d | M | permission, images |
| 5 | Maker talking-head explainer | clip | Reels, Shorts | +10 d | M | clipper |
| 6 | Client note or testimonial card | quote card | Instagram | +14 d | M | card, permission |
| 7 | Letter mention | letter mention | Newsletter | next issue | L | nl |
| 8 | Availability update (slots open) | story | Instagram | monthly, on trigger | L | availability field |
| 9 | Cross-link from related artwork pages | cross-link | Site | +14 d | L | xlink |
| 10 | Q&A live on the service | live | YouTube, Facebook | +30 d | H | live |

### 8.10 Live stream

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Announce stream with time and link | link post | All | −14 d | M | cal, scheduled live event |
| 2 | Letter mention | letter mention | Newsletter | −10 d | L | nl |
| 3 | Topic teaser card | quote card | Instagram | −7 d | M | card |
| 4 | Reminder | story/post | Instagram, Facebook | −1 d | L | cal |
| 5 | Going-live post | story/link | Instagram, Facebook | 0, at start | L | live trigger |
| 6 | Pin chat link or reply to comments | reply | Platform | during | L | stream-chat |
| 7 | Recording uploaded | cross-link | YouTube, site | +1 d | M | recording import |
| 8 | Three highlight clips | clip | Reels, Shorts | +2 to +7 d | M | clipper |
| 9 | Recap letter mention with recording | letter mention | Newsletter | next issue | L | nl |
| 10 | Summary write-up or transcript page | cross-link | Site | +7 d | H | transcript |

### 8.11 Newsletter issue

| # | Action | Type | Outlet | Timing | Effort | Needs |
|---|---|---|---|---|---|---|
| 1 | Web archive page for the issue | link post anchor | Site | 0 | L | web version |
| 2 | Social teaser with one item from the issue | link post | Facebook, Instagram | 0 | L | OG, card |
| 3 | Subscribe prompt card | quote card | Instagram story | +1 d | L | card |
| 4 | Resend to unopened with a new subject | letter | Email | +2 to +3 d, once | L | resend feature (Kit-style), use sparingly |
| 5 | Highlight clip of lead item | clip | Reels | +3 d | M | clipper |
| 6 | Thread of the issue's main points | reply or thread | Threads | +4 d | M | thread composer |
| 7 | Cross-link to the items from the issue's pages | cross-link | Site | +1 d | L | xlink |
| 8 | Reply to subscribers' responses | reply | Email | +3 d | L | inbox |
| 9 | Preview in next issue ("last month...") | letter mention | Newsletter | +30 d | L | nl |
| 10 | Re-share archive page if evergreen | repost | Facebook, Threads | +90 d | L | evergreen flag |

## 9. Candidate follow-up ladders

Offsets and ordering are **[assumed]**, assembled from the practices cited above. A ladder is a list of (anchor, offset, action, outlet) with each step optional; steps the piece cannot support (no clip, no live channel enabled) are dropped, not shown as failures.

1. **Artwork launch.** page 0 → IG cover 0/+1 d → FB link after page and preview exist → +3 d walk-through clip → +5 d story with availability → +10 d process writing → next letter → next open-studio live → sold/available update on trigger. Suits artwork, product or print, service (drop clip and writing).
2. **Essay.** page 0 → FB link with excerpt 0 → IG pull-quote 0/+1 d → +1 d Threads thread → +4 d second quote → +7 d reading clip → letter → +14 d response piece or group thread → +60–90 d re-share if evergreen. Suits writing, newsletter issue (archive page), long video (swap reading clip for highlights).
3. **Event countdown.** −28 d announce and letter save-the-date → −14 d card → −10 d preview clip → −7 d reminder → −1 d reminder with directions or join link → 0 today post and story or live → +1 d recap and recording. Suits meeting or event and live stream (shorter: −14 d start).
4. **Workshop enrolment.** −28 d announce with registration → −21 d instructor clip → −14 d sample work → −10 d seats update (triggered) → −7 d registrant reminder → −2 d last call → −1 d materials → +2 d participant recap → +3 d next-session interest. Suits workshop or class, and the first session of a series.
5. **Series run.** −21 d announce and cover → −14 d letter → −2 d first-session reminder → per session: −1 d reminder, +1 d recap, +2 d clip → halfway catch-up letter → last-call before join cut-off → +3 d wrap-up and interest list. Suits series.
6. **Long video release.** publish 0 with trailer clip → FB link 0 → +1 d quote card → +2, +5, +9 d highlight clips → +3 d transcript page → letter → +10 d written summary → +21 d live Q&A. Suits long video and live stream (recording).
7. **Short clip.** one lead platform 0 → cross-post to Shorts and Facebook 0/+1 d → site embed 0 → +2 d story → +7 d longer cut or subtitled variant → letter. Suits short video; also the tail of the others.

Rules that cut across ladders **[assumed]**: do not place two steps for the same piece on one outlet in one day; stagger a repeated outlet by at least two days; steps that depend on a date anchor to the date and do not float with routines (the Buffer distinction); a step that depends on an asset (clip, card) is suggested only after that asset exists or with a "make it" action.

## 10. Notification and nudge practice

Evidence: developer documentation and vendor blogs; no primary studies found. Statistics quoted in those sources (Localytics 2 to 5 pushes per week, Braze 35 percent digest uplift) could not be traced to primary reports and should not be cited as facts.

- **Batch related events into one message** and use time-window digests for informational items rather than per-event alerts. ([SuprSend digest](https://www.suprsend.com/post/notification-batching-and-digest), [Courier](https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas)) [vendor claim]
- **Frequency caps at day and week level, per category**, with a stricter cap for promotional-type nudges than for transactional ones; example in developer docs: at most 3 per hour per user and 1 per day for marketing. ([Novu throttle](https://docs.novu.co/.mintlify/skills/dashboard-workflows/references/throttle-step), [SuprSend](https://docs.suprsend.com/docs/best-practices-for-batching-digest)) [doc]
- **Throttle drops; digest combines.** Choose digest for suggestions, since a dropped suggestion is lost. (Novu docs, above) [doc]
- **Route low-priority items to an in-app feed or email**, not push. (Courier, above) [vendor claim]
- **User control:** digest frequency and quiet hours set by the person. (SuprSend) [vendor claim]
- **Reminder tools for Instagram** send a push at publish time because the platform requires manual completion; they do not suggest content. Buffer's wording is an example of keeping "reminder sent" distinct from "published". [doc]
- **Resend/re-engagement features are positioned as sparing:** Kit says to save resend for the most important announcements. [doc]

**Design implications [assumed].** Show suggestions in the console as passive rows (no push) with a dismiss that persists (Channel's `dismissed` delivery row already does this); send at most one digest per day or week that groups due items; cap dated reminders to the three or four anchors in a ladder; never re-suggest a dismissed item within a stated period; and give a per-piece or per-kind "no suggestions" switch.

## 11. Open questions

- Which Instagram publishing cap applies to the collective's app: run `content_publishing_limit` for a live account. Meta's page cites both 100 and 50; the long-cited 25 is in Channel's brief.
- Whether any of Sprout Social, Planoly, Later and Metricool has a follow-up or gap feature: not checked.
- Whether artists' audiences follow the webinar and e-commerce norms for reminders and newsletter frequency: no arts-specific data was found.
- Instagram Reel maximum length for the connected accounts: sources conflict.

## 12. Sources

Scheduling and tools
- Buffer, timezones and posting schedules: https://support.buffer.com/en-us/articles/setting-up-your-timezones-and-posting-schedules-P4iSag90Fl
- Buffer, Instagram posts, Reels, Stories and notifications: https://support.buffer.com/articles/scheduling-instagram-posts-reels-stories-and-notifications-3XA98S9Q5p.md
- Typefully comparison: https://notanothertool.pages.dev/compare/typefully-vs-metricool
- Typefully next free slot (Zapier): https://zapier.com/apps/castmagic/integrations/typefully/1761747/create-ai-content-in-castmagic-and-schedule-new-drafts-in-next-free-slot-in-typefully
- Hootsuite best times in planner: https://www.hootsuite.com/whats-new/best-times-to-publish-is-now-in-planner
- Hootsuite best time to post: https://hootsuite.com/platform/best-time-to-post-on-social-media
- Brandwatch, scheduling Reels: https://www.brandwatch.com/blog/schedule-instagram-reels/
- Postcron reminders: https://intercom.help/postcron/en/articles/7150933-how-do-instagram-reminders-work
- Sendible reminder profile: https://support.sendible.com/hc/en-us/articles/211394723
- Tailwind Instagram mobile scheduling: https://support.tailwindapp.com/en/articles/4546358-new-how-do-i-schedule-to-instagram-on-the-mobile-app
- SmarterQueue recycling: https://get-help.smarterqueue.com/article/689-recycle-evergreen-content-to-maximize-reach
- SocialBee evergreen vs share once: https://help.socialbee.com/article/73-evergreen-vs-share-once
- SocialBu post recycling: https://socialbu.com/blog/social-media-post-recycling
- Kit resend to unopens: https://help.kit.com/en/articles/2502652-resending-to-unopens
- Beehiiv re-engagement automation: https://www.beehiiv.com/support/article/16666074781975

Timing studies
- Buffer 9.6 M posts: https://buffer.com/resources/when-is-the-best-time-to-post-on-instagram
- Buffer best time (reach method): https://buffer.com/library/best-time-to-post-on-instagram
- SocialPilot 7 M posts: https://www.socialpilot.co/blog/instagram/best-time-to-post-on-instagram
- Metricool 24 M posts: https://metricool.com/best-time-to-post-instagram/
- Practitioner timing note: https://www.lilachbullock.com/best-time-to-post-on-instagram/
- Frequency (Union Metrics via SEO Inc): https://www.seoinc.com/seo-blog/best-times-post-instagram/

Repurposing and arts practice
- DashClicks atomization: https://dashclicks.com/blog/content-atomization
- Girard Media: https://girardmedia.com/blog/content-atomization-repurposing-framework
- SocialRevver: https://www.socialrevver.com/blog/content-repurposing-framework
- PostEverywhere: https://posteverywhere.ai/social-media-terms/content-atomization
- Louisville Visual Art open-studio timeline: https://www.louisvillevisualart.org/artist-timeline
- Devon Artist Network open studios: https://openstudios.devonartistnetwork.co.uk/wp-content/uploads/2024/07/1-intro.pdf
- Vermont Crafts seminar notes: https://www.vermontcrafts.com/wp-content/uploads/2023/03/Minutes-from-Seminar-22223.pdf
- Swindon Open Studios: https://www.swindonopenstudios.org/post/why-it-pays-to-be-social
- River of Art social cheat sheet: https://www.riverofart.com.au/wp-content/uploads/2024/08/2024-SOCIAL-MEDIA-CHEAT-SHEET-1.pdf

Events
- Knak webinar emails: https://knak.com/blog/the-different-types-of-webinar-emails/
- Contrast, when to promote: https://www.getcontrast.io/learn/when-to-promote-your-webinar
- Wolters Kluwer registration tips: https://www.wolterskluwer.com/fr-be/expert-insights/5-simple-tips-to-increase-your-webinar-registrations
- Storyblok benchmark report: https://a.storyblok.com/f/110864/x/1826cdb36a/benchmark-report-2027.pdf
- MediaPost, email and webinar attendance: https://www.mediapost.com/publications/article/321495/a-gentle-nudge-how-email-drives-webinar-attendanc.html
- aEvent checklist: https://aevent.com/?p=47123

Platform constraints
- Meta, Instagram content publishing (fetched 2026-11-07): https://developers.facebook.com/docs/instagram-platform/content-publishing
- Meta, 2021 launch post (25 posts): https://developers.facebook.com/blog/post/2021/01/26/introducing-instagram-content-publishing-api/
- Kontentino, caption links: https://www.kontentino.com/q-and-a/clickable-links-instagram-captions/
- WP Engine, Facebook debugger: https://wpengine.com/support/using-facebook-opengraph-debugger/
- link.boo, preview not updating: https://link.boo/guides/facebook-link-preview-not-updating
- Piktochart, Shorts length: https://piktochart.com/blog/how-long-youtube-shorts/
- Restream, YouTube live enablement: https://support.restream.io/en/articles/8948773-enable-live-streaming-on-youtube
- StreamElements, YouTube live enablement: https://support.streamelements.com/hc/en-us/articles/23903165152914-How-to-Enable-Live-Streaming-on-YouTube

Newsletters and notifications
- Unsubscribe by frequency: https://emaillistvalidation.com/blog/unsubscribe-rate-by-send-frequency-how-often-is-too-often/
- MailerLite frequency: https://www.mailerlite.com/blog/email-frequency
- SuprSend batching and digest: https://www.suprsend.com/post/notification-batching-and-digest
- SuprSend best practices: https://docs.suprsend.com/docs/best-practices-for-batching-digest
- Novu throttle step: https://docs.novu.co/.mintlify/skills/dashboard-workflows/references/throttle-step
- Courier notification fatigue: https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas
