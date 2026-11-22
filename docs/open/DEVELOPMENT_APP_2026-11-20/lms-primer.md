# How the learning system works today: a primer for Justin

Written 2026-11-22. Read-only: nothing was changed, built or saved. I started from the two recent reviews (`workspace-grounding.md`, `workspace-standup.md`) and then checked each claim against the code in `packages/lms`, `packages/lms-ui`, `apps/sophia` and `apps/arts-collective`. Where the code disagreed with the reviews, or the reviews were silent, I say so. Paths are under `~/eac`.

---
## In one paragraph

The learning system is a shared engine (the package `@elkdonis/lms`, with its screens in `@elkdonis/lms-ui`) that holds courses, the people taking them, and what those people write along the way. **Sophia** (the app at sophia.arts-collective.com) is its full home: that is where a visitor browses courses, a learner takes them and keeps a journal, a guide answers what people choose to show them, and an author builds and publishes courses in a "Studio". **arts-collective.com/learn** shows the same learner screens inside the network's own page frame. **The dock** (the small helper on arts-collective.com) follows one course step at a time and can do the thing a step asks for (for example "set up your profile") and tick it off. The dock and the assistant read the engine, not the other way round: they read who is enrolled and which steps are done, and they do not read anyone's journal. The engine is already used for real: 29 courses, 178 steps, 10 enrolments, 11 things written by learners (counted today; nothing read beyond counts).

---
## The pieces

**Course.** A named thing to take, belonging to one organisation, free to the learner. It is private until the author says otherwise ("public", "unlisted" or "private"). It has a title, a one-line summary, a description and a cover. Authors write it as a draft; nothing reaches a reader until they **publish**, which freezes a numbered version. People part-way through are never locked out by a later change.

**Module.** A chapter: a titled, ordered list of steps. It has a title and a short summary and nothing else. A module has no date, no colour, no cover and no materials of its own (it is not even a separate table; it lives inside the course's outline).

**Step.** One thing to do. Each has a title, a summary, body text, optional media (audio, video, image, file, with a transcript), links, and a time estimate. Seven kinds exist:

| Step kind | What the learner does | What gets stored |
|---|---|---|
| Reading | Reads, watches or listens, then presses "I've taken this in" | That it was done |
| Practice | Does or notices something, presses "I did the practice"; may add a note | That it was done, plus an optional practice log |
| Reflection | Answers one question in a box ("never graded"); keeping it completes the step | The written answer |
| Gathering | Goes to a live meeting or workshop that already exists on the network, presses "I was there" | That it was done, plus an optional reflection |
| Conversation | Reads and joins a forum thread, presses "I've joined the conversation" | That it was done (the posts live in the forum, not the journal) |
| Resource | A file or link to keep, presses "Seen" (usually optional) | That it was seen |
| Something to set up | Does a real thing on the network (profile, page, store, organisation); the step ticks itself when the platform sees it exists, and can repeat daily | Nothing new; the platform answers each time |

Kinds are open: a new kind is a small registration plus a screen, with no database change. That is the cheapest way the system grows.

**Run (a course offered to a group, with dates).** Everyone can always take a published course on their own, at their own pace; that is an automatic "always open" run. A **run** is a named group walking the course together. It has a name, a kind ("together, with a guide", "a study circle, peer-led", or "at their own pace, a little at a time"), a start date and an end date, a number of places, who may join (anyone allowed, or only people the guide brings in), a named guide or guides, an optional tie to a workshop, and the starting privacy of what people write. A run stays on the course version it was opened with until its guide moves it forward.

**Enrolment.** A person's seat in one run: active, paused, completed or withdrawn, with the date their clock starts from, and the last step they were on. Pressing "Begin" on a course page enrols you in the always-open run; a guide can bring people into a group run.

**What a learner writes, and who can read it.** Three kinds are stored: reflection, practice log, and a note to the guide. Each is up to 20,000 characters of text, and each carries its own visibility, chosen when written:

- **Me**: only the author.
- **My guide**: the guide or guides named on that run.
- **My circle**: the other people enrolled in the same run, plus its guides.
- **Public**: the open web, allowed only on a public course.

A note to the guide is always guide-only. The run's setting only supplies the starting choice. The words are deleted for real if the learner deletes them (the activity log keeps only that something was written and how widely, never what). The organisation's owners can manage a run but do not read journals through that role alone; only guides named on the run do.

**A guide's answer (acknowledgement).** A guide reads what people showed them (a "To answer" list inside the journal page) and replies in words or an audio link. The learner is emailed. This is the only email the learning system sends.

**Unlock rules (pacing).** Each step can carry one of five rules: after the previous required step (the default), always open, after another module is done, on a calendar date, or a set number of days after the person's start (for a group, the group's start date). That is all the pacing there is; there is no separate "interval" or "weekly" setting. Something already begun is never locked again.

**Awards.** Today one thing earns one: finishing a course. It appears on the journal page. There is also an 84-day practice calendar on that page.

**Tasks.** Steps of the "something to set up" kind are the link to the rest of the platform; the dock shows them and can run the action behind them.

**Pool and refs.** The **pool** is an author's scratch shelf for a course: pasted links, forum threads, files and notes, tagged, each one-click turned into a step. Learners never see it. **Refs** are what a step points at on the rest of the network (a workshop, a meeting, a forum thread, a questionnaire); the engine reads them and never owns them.

---
## Is there already a "work group"?

**Mostly yes in outline, no in the shape you drew.**

What a run gives you today:
- A named group with start and end dates, places, and a guide.
- A way to bring in people (open, or by invitation, or everyone who said yes to a workshop).
- Writing that defaults to "my circle", so the group can read each other's reflections on a step.
- A forum conversation per step, opened for the group with one button, if the run has a forum category.
- One place everyone follows the same course, with their own progress shown to the guide.

What a run does not give you:
- **A shared feed per interval.** The group's shared writing is shown one step at a time (the circle panel at the bottom of a step). There is no screen "everything the group wrote this week", and the circle panel leaves out notes.
- **A repeating step.** A step happens once per person. Only platform "set-up" steps can repeat daily, and they do not repeat as a place to write.
- A page for the group as a place (a home, a roster people can see, "who is here this week"). Guides see a roster; learners do not.
- Peer comments. Only a guide can answer an entry.
- Deadlines, timers, or any message when someone posts.

So a workshop-with-a-group is a course plus one run, and that works now. What you described, a weekly shared journal with pinned materials and a feed, is the missing layer on top.

---
## A walk-through

### Making a course today, as an author (on Sophia)

You must be an owner or guide of an organisation (or a named author on the course). If you are not, Studio does not appear.

1. **/studio**: "Your courses". A form at the bottom, "Start a course": title, one line (who it is for and what changes), and which organisation. It starts private.
2. **/studio/<course>**: the course desk. Edit the title, address, summary, description and who can see it. Add modules and steps (add, rename, remove, move, send a step to another module). Set each step's unlock rule here.
3. **/studio/<course>/<step>**: edit one step: kind, text, media, links, time, the practice or reflection prompt, and for a gathering the workshop it points at (pasted by its forum link).
4. **/studio/<course>/pool**: optional scratch shelf; add things, tag them, send one to a step.
5. **Publish** (back on the course desk). Choose notes; the system labels the change "fix" or "structural". The first publish also creates the always-open run.
6. **Groups**, same desk: "Open a new group". Name, kind, start, places, workshop link (optional), forum category (optional). After it exists you can add a guide by email, set who joins, set the starting privacy, and (if tied to a workshop) press "Bring in everyone who RSVP'd".
7. **/studio/workshops, /studio/schedule, /studio/guides, /studio/traditions**: the hub shelves: which workshops are listed and what stays available after they end, the schedule, the guides directory, traditions.

### Taking one, as a learner

1. **Sophia home** (`/`), **/courses**, **/inner**, **/outer**, **/workshops**, **/guides**, **/schedule**: browse. Anyone, signed in or not, can read a public course.
2. **/<course>**: the course page: summary, "Begin" (needs sign-in; it keeps your place) and "The way through" (modules and steps, with "Opens 14 March" on locked ones).
3. **/<course>/<step>**: the step: do it, write in the box, choose who can read it (the choices offered depend on the run), press the done button. In a group run you also see "the conversation on this step" and what others in the circle shared.
4. **/journal**: "Your journal": everything you wrote, across courses, with who can read each one; guides' answers to you; awards; and, for guides, the "To answer" list. Courses run the same way under **arts-collective.com/learn** (its own journal at `/learn/journal`).
5. **The dock** (arts-collective.com only): shows your current course step and, for set-up steps, offers to do it.

### How a run is tied to a workshop

A workshop is its own thing on the network (a forum thread of kind "workshop": a page, sessions, a price, an RSVP list, a video room or a pasted Zoom link). A run points at it by that thread. **RSVP to enrolment** is: a person says yes (or pays) on the workshop page; a guide then presses "Bring in everyone who RSVP'd" on the run; each person is given access to the course and a seat in the group. I checked: the only place that calls this is that button, so **it is manual, not automatic**. A person who RSVPs tomorrow is not in the run until the next press. The video room stays on the workshop; the course does not hold one. A run can only be tied to a workshop of the same organisation.

---
## Workshop words and learning-system words

| Workshop word | Learning-system word | Status |
|---|---|---|
| Workshop / workspace | Course, plus one run tied to the workshop | Exists |
| Session | Module | Partly: a module is only a title and summary, with no date, colour, cover or materials |
| Step | Step | Exists (7 kinds; no photo, recording or quiz) |
| Participant | Enrolment in the run | Exists |
| Guide | Named guide on the run | Exists |
| Group of participants | The run (kind "together" or "circle") | Exists |
| Ongoing session (repeats weekly) | Nothing | New |
| Interval (day, week) | Unlock by date or by days after start, per step | Partly: no week heading or grouping |
| Pinned material | A step's media, links, resource steps; the course pool | Partly: a module has no materials of its own |
| Journal entry | A reflection, practice log or note | Partly: text only |
| Private journal | Visibility "my guide" (or "me") | Exists |
| Shared journal (Concurrent) | Visibility "my circle" | Partly: shown per step, no group-wide feed, stored per entry |
| Guide comment | A guide's answer (acknowledgement, text or audio, emailed) | Exists |
| Peer comment | Nothing | New |
| Pacing | Unlock rules | Exists |
| Deadline | Nothing (only "opens on", never "closes on") | New |
| Timer, time limit | Nothing (only an estimate in minutes) | New |
| Talk room / Zoom link | Lives on the workshop; the run points at it | Exists (on the workshop side) |
| RSVP brings people in | "Bring in everyone who RSVP'd" button | Partly: manual |
| Group conversation | A forum thread per step, per run | Exists |
| Notify when someone posts | Only "your guide answered" email | New |
| Done / progress | Step state, course completion, award | Exists |
| The sheet beside the page | Nothing: the learner screens are one page per step | New |
| Who is online | Nothing | New |

---
## Where should workspaces be created?

**(a) From each site** (for example `/workspace` on an organisation's own site).
- Owner: you make a workspace where that organisation already lives, next to its workshops, RSVP and price. One more place to learn.
- Learner: finds it where they already signed up. Familiar.
- Build: the first target (innergathering) does not yet use the learning engine and has a lot of unfinished edits across the tree, so a rebuild ships all of it. Every new site repeats the wiring.

**(b) Inside Sophia as a new kind of course, with a `/workspaces` page.**
- Owner: one desk, the Studio you would already use for courses, with guides, pool and groups there. One place to learn.
- Learner: has to come to Sophia, which is a different address from the organisation they know; the workshop's own page (price, RSVP, video room) stays elsewhere.
- Build: Sophia already has the engine, sign-in, studio and journal, and nothing in Sophia has a `/workspaces` route today. But a course has no "kind" field today (it has an area tag from a fixed list of eight), and creating a workshop from Sophia would also have to create the workshop itself, because the price, RSVP and room live on the workshop. A "workspace" is not a different kind of course in the data; it is a course with a run tied to a workshop.

**(c) Both doors onto one thing.**
- Owner: one definition: a workspace is a course plus a run tied to a workshop. You may create it from Sophia (the desk) or from a site (where the workshop is). The same workspace shows in both.
- Learner: enters from wherever they signed up.
- Build: the most work to describe and the least to repeat, if the creating and the screens are built once and mounted twice.

**My pick: (c), built in the order b, then a.** Build the workspace screens and the "create a workspace" action once, as a shared piece, and mount it first on Sophia as `/workspaces` (it already has sign-in, the studio, guides and the journal, and no unfinished edits to collide with). Each organisation site then gets a thin `/workspace` page later that opens the same thing. This differs from the stand-up plan, which mounted first on the innergathering site; the reason I would start on Sophia is the missing dependency and the risk of rebuilding that site. The one thing to settle first is who creates the workshop itself (page, price, RSVP): it must be one action, not two screens.

---
## What the learning system would need to grow

Checked against the code, in a plausible order:

1. **A group-wide read**: "everything the group shared, newest first, filter by person or by week". Today only one step at a time. No new table; one new read.
2. **A "space" step kind** that carries the weekly page (pinned material, the group feed): a registration, no migration.
3. **Module extras**: a date, materials list, cover and colour on a module (the outline is JSON, so additive).
4. **Peer comments** on a shared entry: a new table; today only a guide can answer.
5. **Deadlines and timers**: soft "suggested by" dates can live in step settings (open); real timers need one small column to remember the start.
6. **Entry kinds beyond text**: photo, recording, quiz answers. The stored kind is limited to three values, so this needs a migration.
7. **Automatic RSVP to enrolment** (today a button).
8. **Notifications** (a digest, not per post); today only the guide-answered email.
9. **Creating the workshop and the course together** in one action.
10. **Embeddable parts**: lms-ui is made of whole pages that post forms; a sheet beside a page would need parts it can reuse or the engine's functions called directly.

Not needed to start: presence ("who is online"), timers, and an AI reading journals (a flag exists but nothing reads it).

---
## What I could not verify

- I did not run anything in a browser, so "exists" means the code is there and wired, not that I saw it work signed in.
- Counts are from a SELECT on the database named `elkdonis_dev` (the one the code uses on this machine); I took them to be the live data. 29 courses, 178 steps, 29 runs (26 are the automatic always-open ones, 2 are groups, 1 is a start-at-own-pace run), 10 enrolments, 11 written entries (9 to the guide, 2 only-me, none shared with a circle), 5 guide answers. I did not read any text a learner wrote.
- I did not check what other organisations' sites (innergathering and others) do with the engine beyond the stand-up plan: innergathering does not use it.
- I did not test that "Bring in everyone who RSVP'd" gives learners working access to a private course; the code grants access as it enrols.
- Who can reach `/studio` and `/studio/workshops` on live Sophia was read from code (owners and guides of an organisation, or a named author), not tried.
