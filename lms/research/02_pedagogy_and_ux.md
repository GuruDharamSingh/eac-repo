# 02 — Pedagogy and UX for a small contemplative / arts LMS

*Research note, 2026-09-18. Research only; no code implied. Web sources 2021-2026, linked inline.*

**Who this is for:** adults, dozens to hundreds per course, voluntary, mixed tech comfort, mostly on phones. Teachers are practitioners, not instructional designers. Subjects: contemplative practice, Fourth Way study, art-making, reading groups, yoga/sadhana, business skills for artists.

**Evidence labels used throughout**

| Tag | Meaning |
|---|---|
| **[E]** | Evidence-backed: meta-analyses, replicated findings, standards |
| **[e]** | Weak / mixed / indirect evidence: single studies, vendor platform data, populations unlike ours (mostly undergraduates) |
| **[O]** | Practitioner opinion or my own judgement |
| **[F]** | Fad or myth — evidence is against it, or absent |

A standing caveat: almost all learning-science evidence comes from students learning *testable declarative material*. Very little of it was gathered on meditation, drawing, or reading Gurdjieff. Where I extend a finding to those domains, that is judgement, and it is marked [O].

---

## 1. Instructional design that matters at this scale

### What to keep

| Practice | Verdict | What it means here |
|---|---|---|
| **Backward design** (outcome → evidence → activities) | **[E]** as a coherence tool; [O] for the simplification | Wiggins & McTighe's three stages ([MIT TLL](https://tll.mit.edu/teaching-resources/course-design/backward-design/), [OSU](https://teaching.resources.osu.edu/teaching-topics/using-backward-design-plan-your)). For practitioners, reduce it to three questions asked *before* any content is uploaded: *What will someone be able to do, make, or sustain afterwards? How would you and they know? What is the least they need from you to get there?* |
| **Learning outcomes** | [E] for skills; **[O] caution for contemplative work** | "By the end you will have a 20-minute daily sit you can keep" is honest. "By the end you will experience non-dual awareness" is not an outcome, it is a promise no teacher can keep. Let contemplative courses state **intentions and practices**, and skills courses state **outcomes**. Do not force Bloom-verb boilerplate on anyone. |
| **Chunking / segmenting** | **[E]** | Mayer's segmenting principle: learner-paced meaningful chunks reduce load; a systematic review found segmenting "near universally effective" ([AJET review](https://ajet.org.au/index.php/AJET/article/download/7296/1915/27086), [Columbia CTL](https://ctl.columbia.edu/resources-and-technology/teaching-with-technology/diy-video/effective-videos/)). The famous "6 minutes" figure (Guo et al. 2014) is **[e]**: it measured *watch-time in edX STEM MOOCs*, not learning. Treat it as "split at natural joints, prefer under ~10 min for instruction" — a guided meditation or a painting demo is legitimately 20-40 min. |
| **Retrieval practice** | **[E]** strong | One of the most replicated findings in the field; still under-used ([health professions review 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292765/)). Here: not quizzes-as-grades, but a low-stakes "before you continue — what do you remember of last week's idea?" free-recall box, shown *before* the new lesson. For Fourth Way / reading groups this is a natural fit ("restate the idea in your own words"). |
| **Spacing** | **[E]** strong | Spaced vs. massed retrieval g = 0.74 ([Latimier et al. meta-analysis](https://eric.ed.gov/?id=EJ1310148)); real-classroom effects are smaller and patchier ([9 STEM courses, 2024](https://link.springer.com/article/10.1186/s40594-024-00468-5)). Drip and weekly cohort rhythms give you spacing for free. Revisit key ideas in later lessons rather than building an Anki clone — flashcard SRS suits vocabulary (Sanskrit terms, Fourth Way terminology, colour theory), not practice. |
| **Reflection journaling** | **[E]** medium, with conditions | Reflection interventions show medium positive effects; **prompted/semi-structured beats blank-page; collaborative beats solitary** ([Guo 2021 meta-analysis](https://www.researchgate.net/publication/355662611_How_should_reflection_be_supported_in_higher_education_-_A_meta-analysis_of_reflection_interventions), [2023 meta-analysis](https://www.sciencedirect.com/science/article/abs/pii/S1871187123001414)). So: every reflection box ships with a teacher-written prompt; sharing is optional, never default (see §5). |
| **Practice logs** | [e] + strong [O] | Deliberate-practice literature supports logging *what was practised and what was noticed*; for contemplative work the log should record **that** and **what arose**, not a score. This is the core "assessment" object for sadhana, sitting, and studio practice. |
| **Mastery over completion** | **[E]** for skills | Mastery learning: d ≈ 0.59-0.67 across many meta-analyses ([Visible Learning MetaX](https://www.visiblelearningmetax.com/influences/view/mastery_learning), [2023 practical review](https://www.sciencedirect.com/science/article/pii/S0002945923007386)). Applies to business skills and technique. For practice-based courses, "complete" is the wrong word entirely — prefer "visited", "practised N times", "guide has seen your work". |
| **Cognitive load** | **[E]** | One idea per screen; no decorative media; narration + image beats narration + image + identical on-screen text (redundancy). On a phone this is simply "less on the page". |

### What to ignore

- **Learning styles (VAK etc.)** — **[F]**. No credible evidence that matching style to instruction helps; belief remains 80-95% ([Yale Poorvu](https://poorvucenter.yale.edu/teaching/teaching-resource-library/learning-styles-as-a-myth), [APA](https://www.apa.org/news/press/releases/2019/05/learning-styles-myth)). Do not build a "how do you learn best?" onboarding question. Offer audio + text + video because of *access and context* (commute, low bandwidth, hearing/vision), not styles.
- **Microlearning as a philosophy** — **[e]/[F]**. Reviews are positive but mostly low-quality, short-term, and confounded with segmenting and spacing, which are the active ingredients ([Heliyon review 2024](https://www.sciencedirect.com/science/article/pii/S2405844024174440), [ILE review 2024](https://www.tandfonline.com/doi/abs/10.1080/10494820.2024.2331638)). Small lessons: yes. "Everything in 3 minutes": no — depth subjects need long-form.
- **"Learning pyramid" retention percentages, 70-20-10, attention-span-of-a-goldfish** — **[F]**, no primary source.
- **Bloom's 2-sigma as a product promise** — [e]; never replicated at that size.
- **Completion rate as the north-star metric** — [O]: it rewards short, easy courses. Better: week-1 activation, return rate, practice entries logged, guide-acknowledged work.

---

## 2. Course formats

### The completion evidence, honestly stated

- Best available large dataset: Ruzuku's catalogue analysis (26.6k courses, 1.3M enrolments): **cohort/scheduled 53.4% vs open self-paced 41.9%**; **courses with lesson-level discussion 50.9% vs 37.3% without**; learners who complete a lesson **in week one finish 78.3% vs 17.2%** ([Completion Gap](https://www.ruzuku.com/learn/articles/completion-gap), [cohort vs self-paced](https://www.ruzuku.com/learn/articles/cohort-vs-self-paced)). **[e]** — vendor data, associational, completion flag loosely defined.
- The "MOOCs 3-15% vs cohorts 85-90%+" comparison that circulates is **[F]-adjacent**: no independent head-to-head study; selection bias (paid + committed vs free + curious) and generous vendor definitions ([honest critique](https://aienablement.academy/insights/cohort-completion-rates-honest)). The gap is real; the numbers are marketing.
- What survives scrutiny: **a start date, other people, and a guide who notices you** raise persistence. That matches the Community of Inquiry literature — teaching presence and social presence predict satisfaction and perceived learning ([CoI framework](https://www.thecommunityofinquiry.org/framework)) **[E]** for the association, [e] for causality.

### Format fit

| Format | Fits | Notes |
|---|---|---|
| **Self-paced, open** | Reference material, technique libraries, business skills, "foundations" anyone may need any time | Lowest persistence; fine when the goal is *lookup*, not transformation. Must have excellent resumption (§3). |
| **Drip (scheduled release)** | Sadhana programmes, 10/21/40-day practices, introductions | Gives spacing + a shared rhythm with near-zero teacher load. Insight Timer's 10-day audio course is the canonical shape ([how courses work](https://help.insighttimer.com/support/solutions/articles/67000664709-what-are-insight-courses-and-how-do-they-work-)). Let late joiners start their own day 1 ("personal drip") unless the teacher pins calendar dates. |
| **Cohort, live + async** | Anything needing feedback or relationship: art critique, Fourth Way groups, teacher trainings | Maven's guidance: start small (3-4 × 90-min sessions over 1-2 weeks), most run 4-8 weeks, ~1 hr project work per week, workshops with 1-2 objectives, "I do / we do / you do" ([course length](https://help.maven.com/en/articles/6735759-determining-course-length), [top-rated design](https://help.maven.com/en/articles/11139376-designing-a-top-rated-course)). ~70/30 async/live is a common practitioner ratio [O]. Always record; many learners are in other time zones or on shift work. |
| **Study circle / reading group** | Fourth Way Book Readers, scripture/text study, artists' business book clubs | Swedish study-circle tradition: **7-12 people, peer-led with a facilitator, participants' experience as the starting material, fixed term** ([EPALE](https://epale.ec.europa.eu/en/blog/study-circle-swedish-method-adult-education)). Needs almost no "content": a reading schedule, a question per meeting, a place for notes, a call link. This is the cheapest format to support and the network already runs it. **Build it first-class, not as a degenerate course.** |
| **Community of practice (ongoing)** | Weekly sits, open studio, sangha | No end date, no completion. The "course" is a recurring gathering + a shared log. Reuse meetings/rota rather than lesson structures. |
| **Apprenticeship / mentorship** | Art-making, teacher formation, advanced practice | Cognitive-apprenticeship moves (model → coach → fade) [E in craft education, e online]. Product need is tiny: a private 1:1 thread between learner and guide attached to submitted work, and a guide sign-off (§6). |
| **Retreat / intensive** | Contemplative and studio work | The online part is *before* (preparation, logistics, intention-setting) and *after* (integration prompts at 1, 7, 30 days — spacing again). Post-retreat integration is where adverse effects surface (§5), so the follow-up is a safety feature, not marketing. |
| **Paths of small courses** | Everything, eventually | Many 2-4 week units beat one 6-month monolith: earlier wins, lower authoring risk, week-1 activation repeats. A path is an ordered (or loosely ordered) list with optional prerequisites and guide-gated steps. Waking Up's Introductory Course → open library is the pattern. [O] |

**Recommendation [O]:** one underlying "offering" model with four rhythm presets — *Open*, *Drip*, *Cohort*, *Circle* — plus *Path* as a container. Teachers pick a rhythm; they should not have to understand the taxonomy above.

---

## 3. Learner experience design

### Onboarding
- **Week one is the whole game**: first-week lesson completion is the strongest persistence predictor in the Ruzuku data (78% vs 17%) **[e]**. Design the first lesson to be finishable in one short phone session, within minutes of enrolling, and make it a *practice*, not an orientation video.
- Ask at most two things up front: *what brings you here* (free text, shown to the guide) and *when do you want reminders* (including "never"). Maven's pre-course "Reflections" does the first ([Maven](https://help.maven.com/en/articles/11139376-designing-a-top-rated-course)). [O]
- No learning-style quiz [F]. No forced profile completion.
- Magic-link / OAuth sign-in satisfies WCAG 2.2 *Accessible Authentication* and helps low-tech-comfort users.

### The lesson page (phone-first)
One column, in this order [O, consistent with cognitive-load evidence]:
1. Where am I (course · lesson n of N · est. minutes).
2. Optional recall prompt from last time (retrieval, collapsible, never blocking).
3. **One primary medium** (audio *or* video *or* text) with transcript/notes beneath.
4. The practice or task, stated as one sentence.
5. Reflection box (private by default) with the teacher's prompt.
6. Discussion for this lesson (collapsed, count visible).
7. One big "Next" / "Mark as practised" target.

Avoid sidebars, tabs-within-tabs, autoplaying next lesson (contemplative content needs the silence after).

### Progress visibility
- Show progress as **place, not score**: "Lesson 4 of 9", a simple path line, a calendar of days practised. **[O]**
- For practice courses, replace the percentage bar with a **practice calendar** the learner can annotate. Missing days render neutral, not red.
- Progress is private by default. No leaderboards.

### Streaks and gamification — handle with tongs
- Extrinsic rewards can crowd out intrinsic motivation (overjustification) — long-standing finding **[E]**; in gamified fitness apps, motivation-crowding reduced intent to continue ([mixed-methods study 2024](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10807424/)); a Duolingo case study documented streak-protection replacing learning as the goal ([arXiv 2203.16175](https://arxiv.org/pdf/2203.16175)) **[e]**.
- For contemplative work the harm is specific: a streak turns practice into performance and a missed day into guilt — the opposite of the teaching. Plum Village's app is explicitly free of gamification ([review](https://mindful.technology/plum-village-app-review/)); Waking Up keeps tracking deliberately quiet ([overview](https://neurosity.co/guides/calm-vs-headspace-vs-waking-up-2026)). Practitioner commentary agrees ([Yu-kai Chou on streak burnout](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/)) [O].
- **Rule:** no streak counters, points, levels, or leaderboards anywhere by default. Allowed: a private practice calendar; "you have sat 14 times this month" phrased as information; gentle milestones a *guide* confers. Skool-style "level up to unlock the course" is the anti-pattern for this network. If a business-skills teacher wants a checklist with ticks, fine — that is task tracking, not gamification.

### Notifications cadence
- Reminders raise same-day compliance but **may impede habit formation** — reminded students studied *less* on non-reminder days than controls ([npj Science of Learning 2024](https://www.nature.com/articles/s41539-024-00253-7)) **[e]**, single study. Users object to loss of control more than to notifications themselves.
- **Rule [O]:** learner chooses cadence at enrolment (per-lesson / weekly digest / none); default **weekly digest + live-session reminders only**; one-tap change in every message; never re-engagement guilt copy ("You're falling behind!"). Human messages (guide replied to you) always outrank system ones. Email first — many of these learners do not install apps or grant push.
- Tie reminders to the learner's *own chosen cue* ("after morning tea") where possible; that is what habit research actually supports.

### Mobile-first, offline, audio
- Audio is the native medium for contemplative teaching and for phones in pockets: background playback, lock-screen controls, remembered position, variable speed for talks (not for guided practice), a **plain timer with bell** alongside guided sessions (Insight Timer's most-used feature) [O].
- Offline: at minimum, per-lesson "download audio" and cached text via a PWA; reflections written offline must queue and sync, never vanish. Rural and retreat-centre connectivity is a real constraint.
- Serve image/video variants (the network already has `?w=` thumbnailing); never ship a 3 MB master to a phone.
- Large-text-safe layouts; nothing that requires hover; nothing that requires drag.

### Accessibility — WCAG 2.2 AA as the floor **[E, standard]**
New in 2.2 and directly relevant ([Deque summary](https://dequeuniversity.com/resources/wcag-2.2/), [all nine criteria](https://www.wcag22aa.org/new-criteria/)):
- **2.5.8 Target Size** ≥ 24×24 CSS px (aim 44 for primary actions on phones).
- **2.4.11 Focus Not Obscured** — sticky players/headers must not cover the focused element.
- **2.5.7 Dragging Movements** — any reorder (course builder!) needs a non-drag alternative.
- **3.3.8 Accessible Authentication** — no memory/puzzle test; magic link or OAuth.
- **3.3.7 Redundant Entry**, **3.2.6 Consistent Help** — same help link in the same place on every lesson.
Plus the older essentials that courses routinely fail: captions and transcripts for all teaching media, 4.5:1 contrast (a recurring issue in this codebase), reduced-motion respect, headings in order. Transcripts double as search corpus and low-bandwidth mode.

### Low-friction resumption
- Every entry point (home, email digest, course card) has **one** primary action: *Continue — Lesson 5: title (12 min left)*. Resume media position across devices.
- After a long gap (say > 14 days), do not show how far behind they are. Show: "Welcome back. Pick up at Lesson 5, or start with a 3-minute recap." (Recap = retrieval + kindness.) [O]
- In cohorts, offer "catch-up essentials" per week so a missed week is not a reason to quit.

---

## 4. Authoring experience for non-expert teachers

**The risk is not bad pedagogy; it is the course that never ships.** Optimise for a teacher publishing something small and good in one sitting. [O]

- **Minimum viable course**: title, who it is for, one-sentence intention/outcome, 3-5 lessons each with *one medium + one practice + one reflection prompt*, a rhythm preset, a start date or "open". Everything else optional and added later. Maven gives the same advice for first cohorts — 1-2 weeks, not 12 ([Maven](https://maven.com/resources/course-price-and-length)).
- **Blueprints, not blank pages.** Ship 6-8 that encode the pedagogy so teachers never need the vocabulary:
  1. *N-day practice* (drip, audio, daily log)
  2. *Reading circle* (schedule, question per meeting, notes, call link)
  3. *Studio project* (brief → demos → work-in-progress share → final piece → showcase; the Domestika shape — [course structure](https://support.domestika.org/hc/en-us/articles/360003052778-About-Domestika-s-courses))
  4. *Live cohort workshop* (weekly live + async prep + project)
  5. *Talk series* (long-form audio/video + discussion)
  6. *Skills how-to* (short lessons, checklists, templates, mastery checks)
  7. *Retreat companion* (prepare / during / integrate)
  8. *Mentorship track* (submissions + 1:1 thread + sign-off)
- **Guided wizard = backward design in plain words**: "Who is this for?" → "What will be different for them afterwards?" → "How will they (and you) notice?" → "What is the smallest set of sessions that gets them there?" → rhythm → people (guides, capacity) → preview on a phone. The repo's section-keyed wizard and questionnaire substrate is the obvious vehicle.
- **Lesson template with built-in slots** (medium / practice / reflection prompt / recall prompt / discussion on-off). Empty optional slots simply do not render. The template *is* the instructional design.
- **Lint, don't lecture**: soft hints — "this video is 48 min; add chapter markers?", "no transcript yet", "lesson has no practice or prompt", "first lesson is long; week-one completion matters most".
- **Record-first authoring**: upload phone audio/video, get auto-transcript and captions, suggested chapters. Most practitioners teach by speaking.
- **AI-assisted outlining** — useful, bounded. Every major platform now has an outline generator ([Thinkific](https://support.thinkific.com/hc/en-us/articles/16321227901335-AI-Course-Outline-Generator), [Kajabi](https://kajabi.com/updates/ai-course-outline-generator), [LearnWorlds comparison](https://www.learnworlds.com/compare/ai-lms-comparison/)); they produce generic structure and no lesson substance. **[O] for this network:** AI should *structure the teacher's own material* (transcript → chapters, summary, draft recall questions, draft reflection prompts, alt text, captions), never *generate teachings*. Lineage and voice are the product; an AI-written dharma talk is a trust breach. Always draft-only, always labelled, teacher approves.
- **Live from existing assets**: reuse a recorded gathering, a wiki page, a blog post, a Nextcloud folder as a lesson. The network's one-thread-many-surfaces direction suits this.
- **Teaching dashboard for humans**: who is new this week, who has gone quiet, which reflections are shared with me and unanswered, which work awaits acknowledgement. Not funnels and conversion charts.

---

## 5. Community and social learning

- **Discussion per lesson *and* one course-level space.** Lesson-level discussion is associated with materially higher completion (50.9% vs 37.3%) **[e]** ([Ruzuku](https://www.ruzuku.com/learn/articles/completion-gap)) because questions are answered in context. The course-level space carries introductions, logistics and cohort bonding. For small groups (< ~15) collapse to a single thread per week to avoid ghost towns. [O]
- **Seed every discussion with the teacher's question.** Empty "Comments" boxes stay empty; a specific prompt does not. CoI: teaching presence is the lever ([framework](https://www.thecommunityofinquiry.org/framework)) **[E]**.
- **Guide acknowledgement is the highest-value, lowest-cost feature.** A distinct "seen by guide" / short voice reply matters more to learners than peer likes. Insight Timer lets teachers answer classroom questions in audio ([courses](https://help.insighttimer.com/support/solutions/articles/67000664709-what-are-insight-courses-and-how-do-they-work-)); Maven pushes personalised feedback via Loom/comments. Make acknowledgement one tap, make audio reply easy, show guides an "awaiting you" queue. [O]
- **Peer feedback** — valuable for art and business work, risky unscaffolded. Provide a structure (e.g. *what I see / what works / a question*), opt-in per submission, small circles rather than whole-cohort. Collaborative reflection outperforms solitary **[E]** (Guo 2021), but only where trust exists.
- **Privacy of reflections — four explicit levels, default private:** *only me* → *me + guide* → *my circle/cohort* → *public showcase*. Chosen per entry, changeable later, shown on the entry at all times. Never auto-publish a reflection into a feed; never include reflection text in notification emails. Course-level data export and delete. In a multi-tenant network, reflections must not leak across orgs or into global search/forum aggregation.
- **Psychological safety in contemplative contexts — this is a duty-of-care item, not a nicety.**
  - Meditation-related adverse effects are real and not rare in programmes: anxiety/panic, traumatic re-experiencing, dissociation, insomnia; mitigation = **screening, monitoring, trauma-informed modifications, referral resources** ([Britton et al. 2021](https://journals.sagepub.com/doi/10.1177/2167702621996340), [Brown meditation safety toolbox](https://sites.brown.edu/britton/resources/meditation-safety-toolbox/), [Cheetah House](https://www.cheetahhouse.org/about-trainings)) **[E]**.
  - Product implications [O]: a plain "what this course is and is not" note on intensive practices; an always-visible private "this is difficult — tell the guide" route on every practice lesson; teacher-authored alternatives ("eyes open", "shorter", "skip this one"); a network-level resources page; guides get a short safety briefing as part of authoring onboarding; no mechanics that push people to intensify practice (streaks, escalating targets).
  - Community norms per course (confidentiality, no advice-giving unless asked, speak from experience) shown at first post — the study-circle and sangha traditions already have these; let teachers pick a template.
  - Guides can hide a post and move a conversation private in one step.

---

## 6. Assessment without grading

| Mechanism | Use for | Notes |
|---|---|---|
| **Self-assessment against the stated intention** | All | Start / middle / end check-in with the same 2-3 questions, shown back to the learner side by side. Cheap, private, and is itself a reflection intervention **[E-adjacent]**. |
| **Practice log** | Sadhana, sitting, studio habits | Evidence of practice is the assessment. Summaries are descriptive, never scored. |
| **Portfolio** | Art-making, writing, business artefacts | Work-in-progress + final pieces collected across courses on the learner's own profile; learner controls visibility. The network already has profile galleries — reuse. Domestika's final project + project gallery is the reference ([example](https://www.domestika.org/en/courses/1967-drawing-workbook-methodology/projects)). |
| **Guide sign-off** | Paths with real prerequisites, teacher formation, apprenticeship | A named human attests "ready for the next step". This is how these traditions have always worked; the software just records who, when, and an optional note. Supports mastery gating without tests. |
| **Showcase / exhibition** | End of cohort | A shared page or live session where finished work is shown. Opt-in. For arts courses this *is* the capstone; it can link to the marketplace/gallery surfaces later. |
| **Low-stakes recall checks** | Terminology, technique, business skills | Retrieval practice **[E]** — unlimited retries, no recorded score, immediate explanation. Call them "check your understanding", not quizzes. |
| **Badges / certificates** | Sparingly | Useful where a credential has external meaning (teacher training hours, completed business programme). As motivation they carry the same crowding-out risk as other extrinsic rewards **[E]**. Rule: issue **attestations of something real** (hours, guide sign-off, exhibited work), never participation trophies; no badges at all on contemplative courses unless the teacher's tradition has its own form. If issued, use Open Badges 3.0 so they are portable. |

Replace "completed 100%" with richer end states: *attended*, *practised*, *submitted*, *acknowledged by guide*, *signed off*.

---

## 7. Design-language patterns worth borrowing

| Platform | Borrow | Leave |
|---|---|---|
| **Maven** | Syllabus-as-schedule home (what is this week, what is next); projects as first-class; pre/mid/post *Reflections*; short first cohorts; live sessions built as workshops, all recorded ([help centre](https://help.maven.com/en/articles/5597459-home-student-syllabus-schedule)) | Career-ROI framing, heavy sales pages |
| **Circle** | Spaces model — course, discussion, events and members under one roof and one nav; clean event → recording flow | 2025 activity scores and leaderboards ([comparison](https://www.mightynetworks.com/resources/skool-vs-circle)) |
| **Mighty Networks** | Community-first with courses *inside* it; member introductions and "people near you / like you"; structured paths | Feature sprawl, steep setup (2-4 h to configure is fatal for our teachers) |
| **Skool** | Radical simplicity: community + classroom + calendar, nothing else; 30-minute setup as a benchmark for our authoring flow | Points, levels, leaderboards, level-gated content — the explicit anti-pattern here |
| **Kajabi / Teachable / Thinkific** | Blueprint templates at creation; AI outline as a *starting draft*; drip scheduling UI; simple lesson-type picker | Marketing-funnel worldview; completion certificates by default; upsell chrome around lessons |
| **Domestika** | Course = units → short lessons → **one final project**; per-course project gallery and forum; high production trailers; resources attached per unit ([structure](https://support.domestika.org/hc/en-us/articles/360003052778-About-Domestika-s-courses)) | Perpetual-discount pricing theatre |
| **MasterClass** | 10-15 min lessons inside a 2-5 h arc; companion **workbook** PDF; the teacher's presence and voice as the design centre; cinematic restraint, dark calm UI ([review](https://www.cnn.com/cnn-underscored/reviews/masterclass-review)) | Passive "edutainment": no practice, no feedback, no community — inspiring, low learning |
| **Insight Timer courses** | The **10-day audio course** shape; one lesson a day; end-of-lesson reflective question; classroom with **teacher audio replies**; the plain timer; donation-based economics ([requirements](https://help.insighttimer.com/support/solutions/articles/67000664708-instructions-and-requirements-for-courses)) | Marketplace noise, ratings on teachings, visible streak/milestone stats |
| **Waking Up** | Introductory course as the single front door, then an open library; theory and practice as parallel tracks; quiet home screen with one daily item; **free access on request, no questions** — scholarship as a first-class flow ([site](https://www.wakingup.com/)) | Single-teacher centricity |
| **Plum Village app** | No gamification, no ads, free; content organised by *practice* (sit, walk, eat, rest) and by moment of day; bell of mindfulness; lineage visible; "a monastery on your phone" ([app](https://plumvillage.app/), [essay](https://lenedgerly.substack.com/p/a-monastery-on-your-phone)) | Flat library with little sequencing — we do want paths |

**Cross-cutting visual/tone notes [O]:** calm, low-chrome lesson pages; one accent per org (derived, contrast-checked); generous type (≥ 17-18 px body on phones); the teacher's face and voice near the top of every course; warm second-person microcopy with no urgency; absence of numbers where numbers are not the point.

---

## 12 design principles for this platform

1. **Practice over content.** Every lesson ends in something to do, make, or notice. A lesson with only media is a draft.
2. **Three questions before any upload.** Who is it for, what changes for them, how will they notice. Backward design in plain words, enforced by the wizard, not by jargon.
3. **Small units, long paths.** Ship 2-4 week courses and chain them. Segment at natural joints; keep long-form where depth needs it.
4. **Rhythm is a first-class choice.** Open, Drip, Cohort, Circle — and study circles and ongoing gatherings are peers of "courses", not lesser versions.
5. **Win week one.** First lesson is short, is a practice, and is reachable within minutes of enrolling. Measure activation and return, not completion percentage.
6. **A person notices you.** Guide acknowledgement, audio replies and an "awaiting you" queue matter more than any feature a learner uses alone.
7. **No streaks, points, levels or leaderboards.** Show place and history, never score. Missed days are neutral. Anything that pressures intensifying practice is out.
8. **Reflections are private by default, with four visible levels.** Per entry, changeable, never in emails, never across orgs.
9. **Safety is designed in.** Honest course descriptions, alternatives for hard practices, a one-tap private route to the guide, resources page, guide briefing. Adverse effects are expected, not exceptional.
10. **Phone, audio, offline, WCAG 2.2 AA.** One column, one primary action, 24 px+ targets, captions and transcripts, magic-link sign-in, downloads, queued writes.
11. **Always one obvious "Continue".** Resume exactly where they left off; welcome people back without telling them how far behind they are.
12. **Attest what is real.** Portfolios, practice logs, guide sign-off and showcases instead of grades; badges only where they mean something outside the platform. AI structures the teacher's own words — it never writes the teaching.

---

### Source quality notes
- Strongest evidence: retrieval/spacing, segmenting/cognitive load, mastery learning, reflection-with-prompts, learning-styles debunk, motivation crowding, meditation adverse effects, WCAG 2.2.
- Weakest but most product-relevant: all completion-rate figures (vendor data, selection bias), video-length rules (engagement ≠ learning), notification-cadence guidance (one good study + marketing blogs), everything about platform design patterns (reviews and help-centre docs, my synthesis).
- Not found: any controlled study of online course design for contemplative or studio-art learners specifically. Treat §2-§7 recommendations for those domains as informed judgement to be tested with the network's own teachers and a first pilot cohort.
