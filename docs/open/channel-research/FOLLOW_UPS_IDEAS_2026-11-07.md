# Channel follow-ups: proposals for suggested timelines (2026-11-07)

## 1. Summary

This document proposes how Channel could suggest follow-up work for a piece over
weeks, across outlets, and how the LMS could guide a person through it. It
covers rules for when a suggestion appears and stops, 120 follow-up actions (ten
for each of twelve content kinds), six reusable timelines ("follow-up ladders"),
and where each would show in the product. Everything here is a proposal written
from first principles. Nothing was checked with users, no outlet statistics were
consulted, and no code was changed. Platform tool names come from
`docs/open/channel.md` and `docs/open/channel-handoff/README.md` as read on
2026-11-07; "needs: ..." marks a tool that is not described there. Timing and
effort figures are estimates (status: assumed). The main idea: a ladder is a
short list of dated, optional steps attached to a piece; the person sees one or
two at a time; each step either gets done, gets dismissed for good, or expires.

## 2. Principles for nudges

### When a suggestion helps
- It names a concrete missing thing ("Field Notes is not on Facebook"), not a
  general duty ("post more").
- It has a reason the person can read in one line (a gap, a date, a lapse).
- It can be started in one click from where the person already is, and the
  first step is small (open a prefilled quick sheet, not a blank editor).
- It matches something the person has connected or already does. No chip for an
  outlet that is not connected, and none that depends on a tool the person has
  not used, unless the chip says what it will open.
- It is on time. A reminder for a meeting that happened yesterday is worthless;
  expire it rather than carry it forward.

### When it nags
- It repeats after a dismissal, or returns under a new wording.
- It is generic (the same chip on every piece).
- It counts ("you have posted 2 times this week") or compares the person with
  others.
- It asks for effort far above the piece's weight: a 40-minute live for a
  small print that sold last year.
- It fires on private or low-stakes material (daily practice entries, group-only
  threads) toward public outlets.
- It appears while a draft for the same thing is open.

### How many at once
- Home piece face: at most three chips, ordered by date pressure first, then by
  lowest effort.
- "Not placed yet" tray: show four cards, then "N more" collapsed. A tray that
  grows past about eight gets a note offering to dismiss the oldest in one go.
- Dock: one step, always the next dated step of the ladder the person started.
  Never an unprompted suggestion; the dock only shows work the person accepted.
- Per day, across Home: no more than five distinct chips appear on first view
  of that day. The piece board, which the person opened on purpose, shows all
  of that piece's steps.
- No push mail or notification for suggestions. A reminder mail is allowed only
  for a step the person accepted into a plan, and only once.

### How a suggestion stops itself
1. **Done by evidence.** A share whose link is the piece's page (already read
   from `threads.metadata.shares`, `social_posts.shares`, `publish_jobs`)
   resolves the chip without the person marking it. Where evidence is not
   readable (a post made outside the platform), a "Done already" button writes
   the same resolution.
2. **Dismiss is permanent for the pair** (piece, step). The existing
   `dismissed` delivery row does this. Dismiss offers a second tap for
   "Not for this kind of piece" which records a per-person rule (kind, step).
3. **Snooze** (a week, a month, "after the event") for steps that are right but
   badly timed.
4. **Expiry.** Each step carries a window (for example, an event announcement
   expires at the event). Expired steps leave quietly; they are not rolled to
   the next day.
5. **Learned quiet.** After three dismissals of the same step type, ask once:
   "Stop suggesting this for artworks?" A "no" resets the count; the question
   is never asked twice for the same type.
6. **Lapse reminder, once.** "Nothing posted for a while" uses the person's own
   rhythm: it fires when the gap exceeds 2.5 times their median gap between
   posts, with a floor of 10 days, once per lapse. A dismissal sets the next
   lapse threshold higher, not equal. It does not fire for a person with fewer
   than five posts (no rhythm yet), during a stated break, or for an org with no
   routine.
7. **Accepted means converted.** Accepting turns a chip into a plan.md step and
   a draft delivery. The chip disappears; the step is no longer a suggestion
   and follows the plan's own rules.
8. **A global dial**: Off, Light (dated steps and lapses only), Full (all
   suggestions). Default Light. The existing `actionChips` setting remains the
   master switch.
9. **Closed pieces are silent.** Sold, archived, past-event pieces get at most
   one "after" step (recap or revival), then nothing.

### Wording and responsibility
- A chip is a verb phrase that names the object ("Post the walk-through to
  Instagram and Facebook"), at most about 45 characters; the reason sits on a
  second line, shown on hover or in the board.
- Nothing publishes without the person pressing the final button.
- The assistant role of the LMS is guidance: a step opens the matching tool and
  may show a light overlay (coach marks such as "walk toward the piece, keep the
  frame steady"); it does not do the work.
- Member-only and group-only material defaults to group outlets (forum, letter,
  the group's Talk room). A public outlet is an explicit choice.

## 3. Follow-up actions by content kind

Columns: **Chip** is the wording on the chip. **Type** is the sharing type
(repost, quote card, clip, carousel, story, link post, letter mention, live,
reply, cross-link, turn into service or event). **Outlet** abbreviations: IG
Instagram, FB Facebook, Thr Threads, YT YouTube, Page the artist's or org's
page, Site the org site, Market, Letter the newsletter, Forum the Grand Forum.
**Timing** is relative to the first post (`d0`) or, for dated kinds, to the
event (`E`). **Effort**: S under 5 minutes, M 5 to 30, L over 30 (assumed).
**Tool** names the existing tool, or "needs: ...".

Tool shorthand: *Quick sheet* and *New post* are Channel screens; *Post kind*,
*Writing*, *Recordings*, *Clip editor*, *Reel (template)*, *Picture editor*,
*Booth*, *Go live card* and *Relay* are Studio tools; *Letter* is the email
suite; *Offerings* is the service kind; *Series* is series pages and RSVPs.

### 3.1 Artwork

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Post the walk-through to Instagram and Facebook | clip | IG, FB | d0 + 1 to 2 d | M | Recordings (phone capture) + Reel `clip` template with title and subtitle overlays |
| 2 | Film a 30-second talk about it | clip | IG, FB, Page | d0 + 3 to 5 d | M | Recordings + Clip editor, transcript, `subtitles` overlay |
| 3 | Share the market listing | link post | FB, Thr | d0, if listed | S | Quick sheet |
| 4 | Make a card with title and size | quote card | IG | d0 + 2 d | S | needs: quote-card render (sharp route; layout preview exists) |
| 5 | Show a detail, then the piece in a room | carousel | IG | d0 + 7 d | M | Picture editor + Post kind (up to ten pictures) |
| 6 | Go live from the studio | live | YT, FB | d0 + 14 d | L | Booth, Go live card, Relay |
| 7 | Write about how it was made | cross-link | Site, Page | d0 + 7 to 10 d | L | Writing (start in Studio); link back to the artwork |
| 8 | Add to the December letter | letter mention | Letter | next issue | S | Letter; "add to the pool" step (needs: letter pool) |
| 9 | Answer this week's comments | reply | IG, FB | d0 + 3 d | S | needs: comment inbox (Facebook comments exist in `thread_external_comments`; Instagram not) |
| 10 | Offer a print or a lesson from it | turn into service | Market, Page | d0 + 30 d | M | Offerings (service kind) |

### 3.2 Product or print

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Field Notes is not on Facebook: share the shop link | link post | FB | d0 + 1 d | S | Quick sheet (existing gap rule) |
| 2 | Film packing it, 20 seconds | clip | IG | d0 + 3 d | M | Recordings + Reel `clip` template |
| 3 | Show it in a room or in hand | story | IG | d0 + 2 d | S | Post kind + Picture editor; needs: story format |
| 4 | Make a card with price and edition | quote card | IG, FB | d0 + 5 d | S | needs: quote-card render |
| 5 | Add to the letter's shop corner | letter mention | Letter | next issue | S | Letter |
| 6 | Pin it at the top of your page | cross-link | Page | d0 | S | Page editor (pin exists for threads; assumed for products) |
| 7 | Write about how Field Notes was made: start it in the Studio | cross-link | Site | d0 + 7 d | L | Writing |
| 8 | Only a few left: say so | story | IG | when stock is at or below a set count | S | needs: stock event from commerce |
| 9 | Repost a customer's photo (with their yes) | repost | IG | on mention | S | needs: mention intake; Quick sheet |
| 10 | Pair it with another piece | cross-link | Page, Market | d0 + 14 d | M | Page editor; Channel picks the pair from the same maker |

### 3.3 Writing

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Quote one line | quote card | IG, FB | d0 | S | needs: quote-card render |
| 2 | Read the first paragraph aloud | clip | IG, FB, YT | d0 + 2 d | M | Recordings (audio or video) + Reel `text` overlay |
| 3 | Share the link with one sentence | link post | FB, Thr | d0 | S | Quick sheet |
| 4 | Add an excerpt to the letter | letter mention | Letter | next issue | S | Letter |
| 5 | Three passages as slides | carousel | IG | d0 + 4 d | M | Post kind; needs: text-slide template |
| 6 | Ask the forum a question about it | cross-link | Forum | d0 + 1 d | S | Forum thread via actions registry (assumed) |
| 7 | Read it with a study group | turn into event | Series | d0 + 14 d | M | Series + RSVP |
| 8 | Reply to the first response | reply | Site, Forum | on response | S | needs: response notice |
| 9 | Bring it back: "from the archive" | repost | IG, FB | d0 + 90 d | S | Quick sheet; Channel's lapse rule |
| 10 | Turn it into a talk or workshop | turn into service | Page | d0 + 30 d | L | Offerings, Series |

### 3.4 Short clip

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Post it to Facebook too | repost | FB | d0 | S | Quick sheet (outlet gap) |
| 2 | Add subtitles | clip | IG, FB | before d0 | S | Transcripts + `subtitles` overlay |
| 3 | Re-cut vertical for stories | story | IG | d0 + 1 d | M | Clip editor |
| 4 | Pin it to your page | cross-link | Page | d0 | S | Page editor; reels already publish to the ArtDirect page |
| 5 | Embed it in the piece it shows | cross-link | Site | d0 | S | needs: lineage link (`studio_items`) |
| 6 | Ask a question in the caption | reply | IG, FB | d0 + 1 d | S | Post kind (edit caption) |
| 7 | Use a still as a card | quote card | IG | d0 + 3 d | S | Picture editor |
| 8 | Join three clips into a monthly reel | clip | IG, YT | end of month | M | Reel templates |
| 9 | Mention it in the letter | letter mention | Letter | next issue | S | Letter |
| 10 | Expand it into a longer talk | clip | YT | d0 + 14 d | L | Recordings + Clip editor |

### 3.5 Long video

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Cut three 30-second clips | clip | IG, FB | d0 + 1 d | M | Clip editor (cuts, timeline) |
| 2 | Add chapters and the transcript to its page | cross-link | Site | d0 | M | Transcripts (whisper small.en) |
| 3 | Post it to YouTube | link post | YT | d0 | S | needs: YouTube upload (live and chat exist; upload not described) |
| 4 | Burn in subtitles | clip | IG, FB | d0 | S | `subtitles` overlay |
| 5 | Make a poster card | quote card | IG, FB | d0 | S | Picture editor |
| 6 | Tell the letter list to watch | letter mention | Letter | d0 + 2 d | S | Letter |
| 7 | Host a watch party with chat | live | YT, Talk | d0 + 7 d | L | Booth, Relay, stream chat |
| 8 | Write a short summary | cross-link | Site | d0 + 3 d | M | Writing; transcript as source |
| 9 | Open a forum thread for questions | cross-link | Forum | d0 + 1 d | S | Forum thread |
| 10 | Turn it into a course or session | turn into service | Page | d0 + 30 d | L | Offerings, LMS course |

### 3.6 Series

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Announce the series with its cover | quote card | IG, FB | E1 minus 21 d | S | Series cover + needs: quote-card render |
| 2 | Write to the series list | letter mention | Letter | E1 minus 14 d | S | Letter (per-series mailing) |
| 3 | Remind people the day before | story | IG, FB | each session minus 1 d | S | Series; needs: story format |
| 4 | Post three lines from last session | link post | FB, Thr | each session plus 1 d | S | Quick sheet |
| 5 | Share a clip from the last session | clip | IG | each session plus 2 d | M | Recordings + Clip editor |
| 6 | Invite a friend with the RSVP link | link post | FB, IG story | midpoint | S | Series RSVP link |
| 7 | Say there is still room | link post | FB | E1 minus 3 d | S | Series (seat count) |
| 8 | Send the notes to subscribers | letter mention | Letter | session plus 1 d | M | Letter (per-series) |
| 9 | Ask what comes next | turn into event | Series | final session | M | Series planner |
| 10 | Link the series to related writing | cross-link | Site | d0 | S | Page editor |

### 3.7 Meeting or event

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Announce the date | quote card | IG, FB | E minus 14 d | S | needs: quote-card render |
| 2 | Add it to the letter | letter mention | Letter | E minus 7 d | S | Letter |
| 3 | Remind people tomorrow | story | IG, FB | E minus 1 d | S | Quick sheet |
| 4 | Post the join link an hour before | link post | FB, Thr | E minus 1 h | S | needs: send worker (scheduled posts are plans only) |
| 5 | Go live from the room | live | YT, FB | E | L | Booth, Go live card |
| 6 | Post one photo from the room | story | IG | E | S | Post kind (phone) |
| 7 | Thank people and give a recap | link post | FB, Site | E plus 1 d | S | Quick sheet |
| 8 | Share a clip of the recording | clip | IG | E plus 2 d | M | Clip editor, transcripts |
| 9 | Send notes to those who said yes | letter mention | Letter | E plus 1 d | M | Letter to RSVP list |
| 10 | Propose the next date | turn into event | Series | E plus 3 d | M | Series planner |

### 3.8 Workshop

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Announce what people will make | carousel | IG, FB | E minus 30 d | M | Post kind, Picture editor |
| 2 | Show the seats left | story | IG | E minus 14 d, E minus 3 d | S | Offerings (seat count) |
| 3 | Film the materials, 20 seconds | clip | IG | E minus 10 d | M | Recordings + Reel `clip` template |
| 4 | Feature it in the letter | letter mention | Letter | E minus 21 d | S | Letter |
| 5 | Send the preparation list | letter mention | Letter (enrolled) | E minus 3 d | S | Letter to attendees |
| 6 | Hold a free preview talk | live | YT, FB | E minus 7 d | L | Booth, Go live card |
| 7 | Post work in progress | story | IG | E | S | Post kind |
| 8 | Share what people made (with yes) | repost | IG, FB | E plus 2 d | M | Quick sheet |
| 9 | Write up the day | cross-link | Site | E plus 7 d | L | Writing |
| 10 | Open the next date or a waitlist | turn into event | Offerings | E plus 7 d | M | Offerings, Series |

### 3.9 Service

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Say who this is for | quote card | IG, FB | d0 | S | needs: quote-card render |
| 2 | Share a client's words (with yes) | repost | IG, FB, Page | d0 + 14 d | S | Quick sheet |
| 3 | Show what a session is like | clip | IG, FB | d0 + 3 d | M | Recordings + Clip editor |
| 4 | Post the booking link | link post | FB, Thr | d0 | S | Quick sheet; card booking via checkout |
| 5 | Add "Working with me" to the letter | letter mention | Letter | next issue | S | Letter |
| 6 | Pin it on your page | cross-link | Page | d0 | S | Page editor |
| 7 | Say which times are open this week | story | IG | weekly | S | Offerings (time scheduling); needs: open-slot feed |
| 8 | Answer a common question | cross-link | Site | d0 + 10 d | M | Writing |
| 9 | Link it to a piece of yours | cross-link | Page | d0 + 7 d | S | Page editor |
| 10 | Offer it again for the season | link post | FB, IG | quarterly | S | Quick sheet; Channel's lapse rule |

### 3.10 Live stream

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Announce the live | quote card | IG, FB | E minus 7 d | S | needs: quote-card render |
| 2 | Remind people tomorrow | story | IG, FB | E minus 1 d | S | Quick sheet |
| 3 | Post "we are live" | link post | FB, Thr | E | S | Go live card (post on go live: assumed, not described) |
| 4 | Ask for questions ahead | reply | IG, FB | E minus 3 d | S | Post kind (caption) |
| 5 | Clip the best minute | clip | IG, FB | E plus 1 d | M | Clip editor, transcripts |
| 6 | Put the replay on your page | cross-link | Page, YT | E plus 1 d | S | Booth recording copied to Recordings |
| 7 | Post highlights | carousel | IG | E plus 1 d | M | Picture editor, Post kind |
| 8 | Send the replay in the letter | letter mention | Letter | E plus 3 d | S | Letter |
| 9 | Write a summary from the transcript | cross-link | Site | E plus 5 d | M | Writing, transcripts |
| 10 | Schedule the next one | live | Routine slot | E plus 14 d | S | Queue routines |

### 3.11 Newsletter issue

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Put the web copy on your site | cross-link | Site | d0 | S | Letter (web version); needs: archive page |
| 2 | Tease one item | story | IG | d0 | S | Quick sheet |
| 3 | Share the link | link post | FB, Thr | d0 + 1 d | S | Quick sheet |
| 4 | Post the item people clicked most | link post | IG, FB | d0 + 7 d | S | needs: click counts per item |
| 5 | Answer replies | reply | Letter, Forum | d0 + 2 d | M | needs: reply intake |
| 6 | Add a subscribe prompt to your page | cross-link | Page | d0 | S | Page editor |
| 7 | Resend to people who did not open | letter mention | Letter | d0 + 3 d | S | Letter; needs: open tracking |
| 8 | Quote the opening line | quote card | IG, FB | d0 + 2 d | S | needs: quote-card render |
| 9 | Start a pool for the next issue | cross-link | Letter | d0 + 1 d | S | needs: letter pool |
| 10 | Collect the year's best | turn into event | Letter, Site | December | L | Letter, Writing |

### 3.12 Daily practice entry (Akhand Path day)

These default to the group's outlets (Forum, Letter, Talk). Public outlets are
off unless the group turns them on.

| # | Chip | Type | Outlet | Timing | Effort | Tool |
|---|---|---|---|---|---|---|
| 1 | Mark today's reading done | reply | Forum | day | S | `paath-day` entry, LMS `task.repeat` |
| 2 | Share one line of today's passage | quote card | Forum, IG (opt in) | day | S | needs: quote-card render; text rights to confirm |
| 3 | Record today's reading, audio | clip | Forum, Talk | day | M | Recordings (audio) |
| 4 | Welcome the newest reader | reply | Forum | on enrolment | S | Enrolment event; Quick sheet |
| 5 | Note that seven days are read | reply | Forum | day 7, 14, 21 | S | Routine progress (enrolled readers only) |
| 6 | Ask a reflection question | cross-link | Forum | weekly | S | Forum thread |
| 7 | Read together live | live | Talk, YT | weekly or end day | L | Booth, Relay |
| 8 | Add the week to the letter | letter mention | Letter | weekly | S | Letter (digest) |
| 9 | Post the practice space photo | story | IG (opt in) | day | S | Post kind |
| 10 | Invite readers to the closing gathering | turn into event | Series | final day minus 3 d | M | Series + RSVP |

## 4. Follow-up ladders

A ladder is a list of steps with an anchor (`d0` first post, or `E` the
event), an offset, and optional conditions. Steps are suggestions until the
person starts the ladder; starting it writes the steps as a plan.md section and
draft deliveries. A ladder is never started automatically. "Skip if" means the
step resolves itself by evidence (section 2).

### 4.1 Light path (post and a photo)

Suits: product or print, short clip, newsletter issue, service, any kind when
the person has little time.

| Offset | Step | Skip if |
|---|---|---|
| d0 | Post on the site and page (as the first post) | already published |
| d0 | Share one photo or card to the outlets with a gap | outlet not connected |
| d0 + 7 d | Add to the next letter | no letter routine |
| d0 + 60 d | "From the archive" repost | piece sold or closed |

Branch: after d0 + 7 d, a single chip, "Develop this piece", offers ladders 4.2
or 4.3. If ignored, the ladder ends; it does not ask again.

### 4.2 Artwork to live (develop along the routine)

Suits: artwork, long video, product when it is the maker's own work.

| Offset | Step |
|---|---|
| d0 | Share listing (link post) |
| d0 + 1 d | Walk-through clip to IG and FB |
| d0 + 4 d | 30-second talk, subtitles on |
| d0 + 8 d | Write about how it was made (Studio, Blocks optional) |
| d0 + 12 d | Announce a live (quote card, letter mention) |
| d0 + 14 d | Go live from the studio; the booth graphics carry the piece's title |
| d0 + 15 d | Best-minute clip and replay on the page |

Branch at d0 + 8 d: "Go live" or "Offer a lesson or print". The second branch
creates a service (Offerings) linked from the piece, then continues with
ladder 4.5's last three steps. Steps in a ladder land in the next routine slot
on the matching outlet when one exists (existing placement rule).

### 4.3 Writing to conversation

Suits: writing, long video, newsletter issue.

| Offset | Step |
|---|---|
| d0 | Quote card and link post |
| d0 + 1 d | Forum question |
| d0 + 2 d | Read the opening aloud (clip) |
| d0 + 7 d | Letter excerpt |
| d0 + 14 d | Read it with a study group (event) |
| d0 + 30 d | Link from related writing; ask whether to make a talk |

Branch at d0 + 14 d: if the forum thread has no replies, skip the event step and
offer "Ask in the letter" instead. If it has replies, offer the event.

### 4.4 Event

Suits: meeting or event, series session, live stream.

| Offset | Step |
|---|---|
| E minus 14 d | Announce (card) |
| E minus 7 d | Letter |
| E minus 1 d | Story reminder |
| E minus 1 h | Join link post |
| E | Go live, or one photo |
| E plus 1 d | Thank-you and recap; letter notes to RSVPs |
| E plus 2 d | Clip of the recording |
| E plus 3 d | Propose the next date |

Branch at E minus 3 d: if RSVPs are under the person's own median for similar
events, add "Say there is still room"; otherwise skip it. At E plus 3 d, a
"next date" opens the series planner and the ladder repeats on the new date.

### 4.5 Workshop or service launch

Suits: workshop, service, series (first run).

| Offset | Step |
|---|---|
| E minus 30 d | Announce what people will make (carousel) |
| E minus 21 d | Letter feature |
| E minus 14 d | Seats left (story) |
| E minus 10 d | Materials clip |
| E minus 7 d | Free preview live |
| E minus 3 d | Preparation list to enrolled |
| E | Work in progress (story) |
| E plus 2 d | Participants' work (with yes) |
| E plus 7 d | Write-up; open next date or waitlist |

For a service with no dates, the anchor is `d0` and the steps compress to:
who it is for, session clip, booking link, letter, client words, seasonal repeat.
Branch at E minus 14 d: if seats are full, replace the remaining announce steps
with "Open a second date".

### 4.6 Practice routine

Suits: daily practice entry, any routine (reading, drawing, study).

| Offset | Step |
|---|---|
| Daily | Mark done (a single tick; shows only to enrolled people) |
| Day 7, 14, 21 | Gentle progress note in the forum |
| Weekly | Reflection question; letter digest |
| Weekly or end day | Read together live |
| Final day minus 3 d | Invite to the closing gathering |
| Final day plus 3 d | "What did you notice?" thread; offer to repeat the course |

Branch at the end: repeat the routine, turn it into an event series, or let it
rest. Resting writes a "break" that silences the lapse reminder for that
routine.

## 5. How this would appear in the product

**Home, "Next for this piece".** The piece face keeps the three-chip limit. Each
chip shows the verb phrase, with the reason on the second line ("Not on
Facebook", "Open studio on Nov 21"). The first chip is the next dated step of a
started ladder; if none is started, it is the cheapest gap. A small "Ladder: 3
of 7" label appears only after the person has started one. Dismiss is an icon
on the chip with the three-way menu (dismiss, snooze, not for this kind).

**Queue, "Not placed yet" tray.** Suggested steps and declined placements wait
here as cards of type Gap, Draft or Your note, as the design already shows. A
ladder step with an offset lands on its date in the week; a step without a
free routine slot lands here. Cards show effort as S, M or L and the tool they
open. Expired steps are removed from the tray with an "Expired" line in the
piece's history, not left as clutter. The tray's "N more" fold and the offer to
clear the oldest follow section 2.

**Piece board.** The board is where the whole ladder is visible: a lane per
outlet (as designed) with steps as dashed chips at their offsets, started
steps as drafts, and a short "Ladder" strip above listing the branch point and
the choice ("Go live" or "Offer a lesson"). Choosing a branch rewrites the
remaining chips and appends a "from the board" line to plan.md. "Add N to the
queue" starts the ladder as a batch. Dismissed chips stay visible in a folded
"Set aside" row for undo.

**Dock.** The dock shows one line: the next step of a ladder the person
started, its due date, and one button that opens the tool (quick sheet, clip
editor, booth). When the step uses Studio, the LMS assistant adds a light
overlay of two or three coach marks ("hold the phone sideways", "start with the
piece in frame") that can be closed and turned off per tool. Completing the
step, by evidence or by "Done", advances the dock to the next one; a skipped
step is a dismiss. The dock never shows a step from a ladder the person has not
started. Ladders would be authored as routine courses on the action layer
(registry entries per step), so the LMS and Channel share one definition.

## 6. Open questions and build notes (assumed, unverified)

- Several tool dependencies are not in the platform today: quote-card render,
  story format, send worker for scheduled posts, comment inbox beyond Facebook,
  open and click statistics, a letter pool, stock events. Chips that depend on
  them can appear as "plan only" until the tool exists.
- Lineage between a reel, writing or broadcast and the piece it is about
  (`studio_items`) decides whether "Done by evidence" works for follow-ups.
  Without it, only gaps on the piece's own link resolve themselves.
- Ladder step data would need: id, kinds, anchor, offset, chip text, reason
  template, type, outlet, effort, registry action id, window, skip rule,
  branch. Where it lives (code, `site_config`, or the LMS course store) is
  undecided.
- Whether ladders are per person, per org, or both; org owners may want to set
  defaults for members.
- Thresholds in section 2 (three chips, five a day, 2.5 times the median gap,
  three dismissals) are starting values to test with a few artists, not
  measured figures.
- Public posting of scripture or private-group material needs the owner's rule
  before the daily practice chips offer public outlets.
