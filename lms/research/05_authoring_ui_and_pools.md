# LMS research 05 — Authoring UI, editing features, and the course "pool" (2026-09-18)

Research only. No code, schema or database was touched. Does not repeat `01`–`04`; read `../SYNTHESIS.md` first.

**Legend:** **[V]** read today at the cited primary doc / help page / repo · **[S]** secondary source or search-result summary of a vendor page (indicative; several vendor help centres 403 a fetch) · **[I]** my inference or opinion.

**What we have (from `packages/lms-ui/src/studio.tsx`)** — one long course page: Publish panel ("what would change") → Outline (`<details>` per module, ↑/↓ mini-buttons per step, "Add step" row with title + kind select, a "steps taken out of the outline" drawer) → About → Groups. A separate step page: title, kind, summary, minutes, body (shared Tiptap editor or a textarea), practice / alternative / prompt, **a paste-a-forum-link field for the thread ref**, media rows (kind, link, title, transcript), slug, then "When it opens". Every change is a full form post; no client JS is required. Draft/published is per *course version*, not per step. `ThreadRef.available` already exists in `packages/lms/src/refs.ts`.

**Added while this was being written:** a first **pool** — migration `145_lms_course_pool.sql`, `packages/lms/src/pool.ts` + `unfurl.ts`, `StudioPoolPage` at `/studio/<course>/pool`. §3.7 measures it against the patterns below; §4.3 is ranked with it already in place.

---

## 0. The short version

1. Everyone's outline is a **two-level tree with drag handles, a ⋯ menu, inline rename and a per-item draft/published chip**. Ours has the tree and the move buttons; it lacks the per-item state chip, duplicate, and any "changed since publish" marker on the row itself.
2. The market has converged on **block lessons** (Rise, LearnHouse, Teachable, Thinkific 2026, Circle, Frappe). Our *typed step with named fields* (practice / alternative / prompt) is a deliberate and defensible exception — it is what makes the learner page server-rendered, SEO-clean and consistent. Keep it; borrow block *conveniences* (paste-a-URL-becomes-a-card, templates), not the block canvas.
3. **Nobody in the LMS world has the owner's pool.** LMS "libraries" hold *finished, reusable components* (Open edX, Moodle, Canvas Commons, Rise templates). The pool the owner describes — raw sources gathered for one course's drafting — lives in *research tools*: NotebookLM's sources panel, Are.na channels, Zotero collections, Milanote's "Unsorted" column, Raindrop. The right design is a cross of the two: **NotebookLM's panel + Are.na's connect-by-reference + Moodle's usage column + Open edX's "update available"**.
4. **The pool we built the same day already matches or beats the raw-source tools on capture, first-party search and used/unused.** It is missing: a visibility check on the pasted-thread path (a small leak — fix first), editable titles, any link-rot signal for URLs, a "changed upstream" signal for threads, oEmbed for media links, capture from the forum, and any echo of pool problems in the outline or publish panel. Details in §3.7.

---

## 1. Outline / curriculum builder patterns

### 1.1 What is on screen, product by product

| Product | Outline shape | Reorder | Rename | Per-item state | Bulk | Duplicate | Preview | Change indicator |
|---|---|---|---|---|---|---|---|---|
| **Moodle 4.5–5.1** | Course page *is* the editor behind an **Edit mode** toggle (top right). Left drawer **Course index** mirrors the page, highlights where you are, collapses per section or all at once. | Drag in the page, in the index, or from page → index for long courses; ⋯ → **Move** opens a target dialog (the keyboard path). | Pencil icon, inline, Enter to save. | Hide/Show, plus **"Make available but don't show on course page"** (reachable by link only). | **Bulk actions** button → checkboxes appear + sticky footer: Availability · Duplicate · Move · Delete. Sections *or* activities, never mixed — a deliberate guard. | ⋯ → Duplicate (item and section). | "Switch role to… Student". | none per item. **[V]** [Course homepage 4.5](https://docs.moodle.org/405/en/course/view), **[S]** [LSE bulk-edit note](https://lse.atlassian.net/wiki/spaces/MG/pages/2771222556/Bulk+Edit+Functionality) |
| **Moodle activity chooser** | Modal grid of tiles; tabs All / Starred / Recommended; ⓘ per tile; double-click to add. **5.1**: tabs become *purpose* categories (assessment, collaboration, communication, resources, interactive). | — | — | — | — | — | — | **[V]** course/view page; **[S]** [Open LMS 5.0/5.1 notes](https://support.openlms.net/hc/en-us/articles/25767806327068-What-s-New-In-Moodle-5-0-And-5-1), [Activity chooser 5.2 docs](https://docs.moodle.org/502/en/Activity_chooser) |
| **Open edX Authoring MFE** (default since Teak, June 2025; legacy Studio removed in Ulmo) | Section → Subsection → Unit cards, collapsible; unit page is a vertical stack of components with an "Add new component" tile row (Text, Video, Problem, **Library content**, Advanced). | Drag + move up/down in the ⋯ menu. | Inline pencil. | Status chip per node: *Draft (never published)* / *Published* / *Published, with pending edits* — **the best per-item vocabulary of the lot**. | limited | ⋯ → Duplicate. | "View live" / "Preview". | The chip itself; library-sourced items get an **UPDATE AVAILABLE** sync button. Publishing a container publishes everything inside it (Ulmo). **[V]** [publish statuses](https://docs.openedx.org/en/open-release-sumac.master/educators/how-tos/course_development/publish_library_content.html), [sync doc](https://docs.openedx.org/en/latest/educators/how-tos/course_development/sync_a_library_update_to_your_course.html); **[S]** [Teak notes](https://docs.openedx.org/en/latest/community/release_notes/teak/teak_marketing_notes.html), [Edly on Ulmo](https://edly.io/blog/open-edx-ulmo-release/) |
| **Canvas Modules** | Flat list of modules, each a list of items; "+" on the module opens an **Add item** dialog (type select → pick existing or create new; *External URL* takes URL + name + "load in new tab"; indent level). Add/Edit Module are now side **trays** (2025). | Drag handle; ⋯ → "Move to…" tray (keyboard path). | In the edit tray, not inline. | Green-check / grey-circle **publish icon per item and per module**; module icon opens a menu: publish module + all items / module only / unpublish all. | "Publish All" menu at page top (2023). | ⋯ → Duplicate (item and module). | **Student View** button. | none per item; Blueprint shows lock icons + "unsynced changes". **[S]** [Rice](https://canvasinfo.blogs.rice.edu/bulk-publish-and-unpublish-modules-and-module-items/), [Instructure: external URL item](https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-add-an-external-URL-as-a-module-item/ta-p/967), [UPenn Fall 2025](https://infocanvas.upenn.edu/2025/08/25/whats-new-in-canvas-fall-2025/) |
| **Thinkific** (new builder, beta; default for sites created ≥ 2026-01-28) | Left curriculum tree, centre lesson canvas that "mirrors the learner's view", right settings. Bulk importer: drop many files → one lesson each. | Drag. | Inline. | "Set to draft" per lesson; also free-preview, prerequisite, discussions toggles. | Bulk import only. | **"Copy lessons from"** another course → arrives as "Copy of …". | Preview as student: *all lessons incl. drafts* or *published only* — a useful distinction. | autosave indicator. **[S]** [new builder](https://support.thinkific.com/hc/en-us/articles/37547732533655), [preview](https://support.thinkific.com/hc/en-us/articles/360030737873-Previewing-Your-Course-as-a-Student) |
| **Teachable** | Sections + lessons list. | Drag handles. | Inline. | Publish button per lesson. | **Bulk edit** checkbox mode → publish/unpublish/delete; **bulk upload** = one lesson per file. | yes | Preview as student. | — **[S]** [help](https://support.teachable.com/en/articles/11682451-create-and-set-up-your-course) |
| **Kajabi** | Outline: module → submodule → lesson. | Drag. | — | Draft (default) / Published / **Drip (N days after grant)** / locked-until-date chip per module and lesson. | — | yes | Preview. | — **[S]** [modules](https://help.kajabi.com/articles/products/courses/course-modules), [outline](https://help.kajabi.com/en/articles/12695137-how-to-view-your-course-outline) |
| **Podia** | Sections → lessons; a lesson *is* one thing (text / embed / file / quiz / coaching). | Drag. | — | Draft per lesson; drip per section. | — | ⋯ → Duplicate, **with a destination picker: this section, another section, another course**. | Preview. | — **[V]** [duplicating](https://help.podia.com/en/articles/16300357-duplicating-lessons-quizzes) (via search excerpt) |
| **Circle / Skool / Mighty** | Sections+lessons (Circle), folders+pages (Skool — renameable nouns), overview+sections+lessons (Mighty, cap 500). Course *type* chosen up front in Circle: self-paced / structured (drip) / scheduled (dated). | Drag. | Inline. | Skool: one green published toggle per course/page. | — | — | — | — **[S]** [Skool](https://help.skool.com/article/166-what-is-classroom), [Mighty](https://docs.mightynetworks.com/for-hosts/courses/how-do-i-organize-my-course-with-overviews-sections-and-lessons), [comparison](https://linodash.com/skool-vs-circle/) |
| **Maven** | Syllabus of weekly modules mixing lessons, **live sessions** and **projects**; the student Home is syllabus + schedule in one list. | — | — | — | — | — | — | — **[S]** [Maven help](https://help.maven.com/en/articles/5597459-home-student-syllabus-schedule) |
| **Frappe LMS** | Course → chapter → lesson; "Add Lesson" under each chapter. | Drag. | — | Course-level publish; per-lesson "preview to guests" flag. | — | — | — | — **[V]** [lesson doc](https://docs.frappelms.com/course-creation/add-a-lesson.html) |
| **CourseLit** | Sections (the drip unit) → lessons. | Drag. | — | 2025: **lessons unpublished by default**, Publish switch in the lesson editor. | — | — | — | — **[S]** [releases](https://github.com/codelitdev/courselit/releases) |
| **Rise 360** | Course = ordered lesson list + section headers. | Drag. | Inline. | none (whole-course publish/export). | — | Duplicate lesson; copy to another course. | Preview with device-width switcher. | Review 360 comments. **[S]** |
| **Mindsmith** | Left **filmstrip** of page thumbnails; right-click → duplicate / copy / save as template. | Drag. | — | — | — | yes | ▶ Preview "exactly as learners see it". | **Version history** button, comments per page/tile/lesson. **[V]** [Editor 101](https://help.mindsmith.ai/en/articles/12037477-editing-your-lesson-mindsmith-editor-101) |

### 1.2 What the pattern actually is

- **Drag is the fast path; a "Move to…" dialog is the accessible path.** Moodle and Canvas ship both. Our ↑/↓ buttons are the no-JS equivalent of "Move to…" and are *fine* — but a one-step ↑ is slow across modules. A **"Move to…" select (module + position)** costs one form and removes 90% of the pain without JS. Drag can be a progressive enhancement later. **[I]**
- **State lives on the row.** Open edX's three states map exactly onto our draft/published version pointers: *never published* · *published* · *published, with pending edits*. We compute "what would change" already — for the publish panel only. Put the same fact on each outline row. **[I]**
- **Bulk mode is a mode**, entered explicitly, with a sticky footer, and Moodle refuses to mix sections with items. For a 12–40-step course we do not need it yet. **[I]**
- **Duplicate always asks "where to?"** in the tools that do it well (Podia, Thinkific "copy lessons from"). Duplicate is a *copy* everywhere — no commercial creator tool offers a live-linked lesson.
- **Preview-as-learner has two flavours**: drafts included vs. published only (Thinkific). With our version model that is "preview the draft version" vs "view live".
- **Hidden-but-linkable** (Moodle) is a real state, distinct from draft. We have it at course level (`unlisted`); not needed per step.
- **Session and project items sit in the same list as lessons** (Maven). We already do this with `session` steps. Good.

---

## 2. Lesson / step editor patterns

| Pattern | Who | On screen / interaction | Note for us |
|---|---|---|---|
| **Stacked blocks + block library sidebar** | Rise 360 | Lesson = vertical stack. A "+" between blocks opens a shortcut bar (text, list, image, video, process, flashcards, sorting, continue) and "All blocks" opens a left sidebar by category: Text, Statement, Quote, List, Image, Gallery, Multimedia (audio, video, **embed**, attachment, code), Interactive (accordion, tabs, labeled graphic, process, scenario, sorting, timeline, flashcards, buttons), Knowledge check, Chart, Divider (**"Continue" gate**), Custom. **[V]** [block types](https://www.articulatesupport.com/article/Rise-Lesson-and-Block-Types) | The *Continue* divider and *Statement/Note* blocks are the two a contemplative course would miss. Both are expressible as editor nodes. |
| **Block templates** | Rise 360 | Select blocks → "Save as template" (name ≤ 42 chars, optional "Share with team") → appears in sidebar under Block Templates → click inserts a **copy**; "editing the blocks… won't change the block template"; templates cannot be edited, only re-saved. **[V]** [doc](https://www.articulatesupport.com/article/Rise-Creating-Sharing-and-Reusing-Block-Templates) | Copy semantics, no sync — simplest possible reuse. Our equivalent is a **step blueprint** (see §4 #7). |
| **Notion-like slash editor** | LearnHouse (Tiptap + Hocuspocus) | "/" menu; left drag handle per block for move/duplicate/delete. Blocks: paragraph, H1–6, lists, code; image, video (upload/YouTube), audio, PDF viewer, iframe embed, **web page preview**; quiz, code playground, math, flashcards, scenarios, H5P; callouts (info/warning), badges, tables, divider; an AI "Magic Block". **[V]** [blocks doc](https://docs.learnhouse.app/platform/editor/blocks) | Same editor family as our `@elkdonis/cms-ui/editor`. A "web page preview" node is the piece worth copying. |
| **Hover-plus block editor** | Frappe LMS | Plus icon at left on hover → Text, Heading, YouTube, Quiz, Upload; paste a Vimeo/Google-Slides link to embed. Separate **Instructor Notes** field visible only to staff. "Preview to guests" checkbox. **[V]** [doc](https://docs.frappelms.com/course-creation/add-a-lesson.html) | **Instructor notes per step** is cheap and very useful for a guide desk. |
| **One lesson = one canvas (new)** | Thinkific 2026, Teachable, Circle | Moved *away* from "lesson types" to a canvas mixing text/video/PDF/quiz; autosave; WYSIWYG = learner view. **[S]** | The market left typed lessons because types were *media* types. Ours are *pedagogical* types (practice, reflection, session) — a different thing. Keep. **[I]** |
| **Single rich text** | Canvas RCE, Moodle TinyMCE, Open edX Text component | Toolbar editor; Canvas RCE content autosaves to **browser local storage for 1 hour** and offers to restore on return. **[S]** [Rutgers release note](https://canvas.rutgers.edu/2020/03/24/canvas-release-notes-2020-03-21/) | Local-storage restore is the cheapest autosave there is and needs no server change. |
| **Accessibility checker in the editor** | Canvas RCE | Icon under the editor with an issue count → side tray walks issue by issue with a fix field + "Apply". Rules: adjacent duplicate links, headings > 120 chars, **missing alt**, **alt = filename**, **skipped heading levels**, large-text contrast 3:1, list not marked up as list, table caption/header/scope. **[S]** [Instructure guide](https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-use-the-Accessibility-Checker-in-the-Rich-Content/ta-p/618238), [CU checklist](https://oit.colorado.edu/services/teaching-learning-applications/canvas/accessibility/rich-content-editor-accessibility) |  Five of these are pure functions over HTML; they can run **server-side at save/publish** and print in our publish panel. |
| | Moodle TinyMCE / Brickfield | Built-in checker: alt text, contrast, long unbroken text. Brickfield sidebar claims 92/96 checks with one-click fix. **[S]** [TinyMCE docs](https://docs.moodle.org/502/en/TinyMCE_editor), [Brickfield](https://brickfield.ie/tinymce-checker/) | |
| **Transcripts** | Rise (caption files per video/audio), Circle (auto transcripts), Raindrop (stores YouTube transcripts in its archive), Courseau/Mindsmith (AI narration + captions) **[S]** | Transcript is usually a *property of the media*, hidden in a settings popover. | Ours is a visible required-feeling field beside each media row — **better** for SEO and a11y. Keep; add "missing transcript" to the publish checks. |
| **Side-by-side preview** | Thinkific new builder (editor *is* the preview), Rise (Preview button + device widths), Mindsmith (▶) | Nobody serious does a literal split pane for lessons; they do WYSIWYG or one-click preview. | We need a **"Preview this step as a learner" link that renders the draft**. |
| **Templates / blueprints** | Rise (1,000+ course templates, block templates), Canvas **Blueprint** (master → associated courses; lock per object type; sidebar shows *Unsynced changes* → Sync, with a preview list; locked = overwritten, unlocked = skipped if locally edited), Mindsmith page templates | **[S]** [JHU](https://support.cmts.jhu.edu/hc/en-us/articles/30758133925517-Managing-Course-Content-Using-Canvas-Blueprints) | Blueprint sync is for institutions with 40 sections. Not us. Copy-style templates only. |
| **Comments / review** | Rise Review 360, Mindsmith (per page/tile/lesson), Moodle question bank comments column | | Later; our guides talk to each other already. |
| **AI in the editor** | see §2.1 | | |

### 2.1 AI-assisted builders, 2025–26

| Product | What it does | The UI detail worth noting |
|---|---|---|
| **Rise 360 AI Assistant — "AI course drafts"** | 4 steps: **(1) context + sources** (upload files, paste text, *or URLs*; each source gets a **blue check when analysed**) → (2) course info + learning objectives (edit or regenerate each) → (3) **outline review: edit, reorder, add/delete lessons before anything is drafted** → (4) refine the draft. Also per-block: generate block, convert block type, rewrite tone, TTS narration. **[V]** [doc](https://www.articulatesupport.com/article/AI-Assistant-in-Rise-360-AI-Course-Drafts) | Sources first, outline gate second. The human approves structure before prose exists. |
| **Mindsmith** | Bottom-bar **Agent**: collapsed = quick-add buttons + "Ask the Agent"; expanded = chat, file attach, narration, **accessibility scan**. `Cmd/Ctrl+K` opens it focused on the selected tile. Lessons can start from a storyboard, a document or a SCORM import. **[V]** [Editor 101](https://help.mindsmith.ai/en/articles/12037477-editing-your-lesson-mindsmith-editor-101) | Scoped-to-selection is the right grain. |
| **Courseau** (acquired by LearnUpon, Nov 2025) | Docs, slides, audio/video, **web links** → lessons of ≤ 15 interactive slides; 11 narration voices; 120+ languages. **[S]** [comparison](https://courseagent.ai/blog/courseagent-vs-courseau/) | |
| **Coassemble** | Upload PDF/PPT/SOP → chunked "screens" with quizzes. **[S]** [blog](https://coassemble.com/blog/ai-platforms-converting-documents-courses) | |
| **H5P.com Smart Import** | Sources: file (audio/video/text), **URL (YouTube, Wikipedia, any page)** or pasted text → generates several H5P types; choose output language. **[S]** [tutorial](https://help.h5p.com/hc/en-us/articles/11700800414237-Smart-Import-Step-by-Step-Tutorial) | |
| **Thinkific / Teachable / Kajabi** | Prompt → outline of chapters + lessons (+ sample text in Teachable). Kajabi "Cofounder" (2026) is a business-context assistant. **[S]** [Thinkific](https://support.thinkific.com/hc/en-us/articles/16321227901335-AI-Course-Outline-Generator), [Teachable](https://www.teachable.com/ai-curriculum-generator) | Outline-only generators are the weakest and most generic output. |
| **Moodle 4.5+ AI subsystem** | Provider plugins + "placements": a sparkle button in the text editor (generate text / image), "summarise" on course pages; admin enables per placement. **[S]** [AI subsystem](https://docs.moodle.org/405/en/AI_subsystem) | Provider-agnostic, off by default — the posture that matches SYNTHESIS rule 10. |
| **Gamma 3.0 Agent** (Sept 2025) | Import → file or **paste a link**; "paste mode" restructures existing text into cards; Agent applies changes across a whole deck by chat. Paste a media link on a card → it embeds. **[S]** [import help](https://help.gamma.app/en/articles/11047840-how-can-i-import-slides-or-content-into-gamma) | |
| **NotebookLM** | Not an authoring tool, but the clearest *sources → grounded drafting* UI (§3). | |

**Common shape [I]:** *sources panel → approve an outline → draft → refine per block*. Every credible 2025–26 AI builder starts from the author's own sources, not a bare prompt. That is one more reason to build the pool first: it is the AI seam, whether or not AI ever ships (rule 10: "drafts-only generation").

---

## 3. Resource pool / content library / course workspace  ← the important part

### 3.0 The owner's idea, restated

Threads (posts, meetings, forum topics) and URLs are added to a **pool belonging to one course's drafting area**; the author pulls from the pool into steps. Two distinct jobs hide in that sentence: **capture** (get things in fast, from anywhere) and **place** (turn a pool item into a step, a step's thread ref, a media row, or a link in the body). Most tools do one well.

### 3.1 Two families — and they are not the same thing

| | **Library of finished parts** | **Pool of raw sources** |
|---|---|---|
| Examples | Open edX Content Libraries v2, Moodle content bank + question bank, Canvas Commons/Files/Blueprint, Rise block templates, H5P Hub | NotebookLM sources, Are.na channels, Zotero collections, Raindrop/Pocket/Readwise, Milanote/Miro boards, Notion clip database, Padlet, Classroom "reuse post" |
| Item is | a component ready to show a learner | a pointer + metadata + maybe a snapshot |
| Scope | org / site-wide, shared across courses | one project (notebook / channel / board) |
| Core verb | *reuse* (and keep in sync) | *collect*, then *cite / place* |
| Hard problem | versioning + sync + permissions | capture friction, metadata quality, link rot |
| Shows usage? | sometimes (Moodle: yes) | rarely (Are.na: connections) |

Ours is the **right-hand column with one feature stolen from the left** (usage + "changed upstream"). Do not build a component library. **[I]**

### 3.2 Libraries of finished parts

**Open edX Content Libraries v2** (Sumac → Teak → Ulmo, 2024-12 → 2026-02)
- *Library home:* tiles per item (text, problem, video; since Ulmo also units, subsections, sections). Click a tile → **right sidebar** with Preview (expandable), Manage (tags, collections), Details. **[V]** [homepage doc](https://docs.openedx.org/en/latest/educators/how-tos/course_development/navigate_library_homepage.html)
- *Organising:* **Collections** = named subsets inside a library ("a topic", "problems for one assessment"); **tags** from a taxonomy, and "tags remain attached to Library content when the content is reused in courses". **[V]** via docs search: [collections](https://docs.openedx.org/en/release-teak/educators/how-tos/course_development/build_a_collection_in_a_library.html), [tags](https://docs.openedx.org/en/latest/educators/how-tos/course_development/add_delete_tags_in_library_content.html)
- *Into a course:* on a unit page choose the **Library content** tile → pick a library → search modal → **Add** on a tile. Only *published* library content can be added; needs Library User role or a public-read library. **[V]** [doc](https://docs.openedx.org/en/latest/educators/how-tos/course_development/add_library_content_to_a_course.html)
- *Reference, not copy — with a gate:* the course holds a *downstream link* pinned to the version it took. When the library item is republished the course shows **"UPDATE AVAILABLE"** top-right of the item; clicking opens a **side-by-side Before / After modal** → **Accept changes** or **Ignore changes**. Course-wide: *Content → Library Updates → Review Content Updates* (menu shows a notification dot), one card per library. **[V]** [sync doc, reviewed for Ulmo 2025-12-12](https://docs.openedx.org/en/latest/educators/how-tos/course_development/sync_a_library_update_to_your_course.html)
- *Local edits:* the e2e suite covers accept / decline / **unlink**, distinguishes untouched from customised blocks, and has a **"Keep course content"** choice. **[V]** [openedx/end-to-end-tests#78](https://github.com/openedx/end-to-end-tests/pull/78) (test descriptions; UI wording **[I]**)
- *Lesson:* upstream never pushes; downstream is told and chooses. This is precisely our "typo fixes fast-forward, structural changes are adopted explicitly" rule, applied to references.

**Moodle content bank** — a per-context (course / category / site) store, today only H5P. Items are *referenced* from the file picker via the "Content bank" repository, or **copied** ("Copy content" to make an editable copy). Per-item **listed / unlisted** visibility; unlisted items are visible only to their author and managers. Search box; capability-based permissions (upload, manage own vs any, delete any). No usage report. **[V]** [Content bank 4.5](https://docs.moodle.org/405/en/Content_bank)

**Moodle question bank** (the best *table* in this whole survey) — columns: Question (inline-editable name) · **Status** (Draft / Ready) · **Version** · **Usage** ("the number of quizzes a question is used in, with a link to more specific details") · **Last used** · **Comments** (peer review) · Needs checking · Created by / Modified by; columns can be reordered, resized, hidden. A quiz slot can pin a version or follow **"Always latest"**. **5.0:** bank becomes a shareable activity; a teacher in two courses sees both banks; colleagues can be given reuse-without-edit. **[V]** [Question bank 5.0](https://docs.moodle.org/500/en/Question_bank), **[S]** [Sharing question banks](https://docs.moodle.org/500/en/Sharing_question_banks)
→ *Usage count with a link to where*, *last used*, and *pin vs always-latest* are the three ideas to take.

**Canvas** — four separate mechanisms, which is the warning:
- **Files:** per-course file tree; per-file publish state, "only available with link", date-restricted; **usage rights** (copyright / CC / fair use) can be required *before a file can be published*. **[S]** [Instructure](https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-set-usage-rights-and-user-access-for-a-file-or-folder/ta-p/617208)
- **Commons:** import = **copy**. If the author republishes, the importer sees it under an **Updates** tab and must accept manually; *only the person who imported is notified*. **[S]** [Instructure](https://community.canvaslms.com/t5/Canvas-Commons/How-do-I-view-updates-to-resources-I-previously-imported-from/ta-p/1797)
- **Blueprint:** push-sync with locks (§2).
- **Link validator** (Settings → Validate links): scans all course content; reports dead external links, **links to unpublished content** and **links into another course**; checkbox to include unpublished content. On demand only. **[S]** [Emerson](https://websites.emerson.edu/itg/demystifying-the-canvas-link-validator/), [St Thomas](https://services.stthomas.edu/TDClient/1898/ClientPortal/KB/Article/138184/Canvas-Validate-Links-in-Content-Interpreting-Your-Results)
→ "Links to unpublished content" is exactly our `ThreadRef.available === false` case. Canvas finds it only when asked; we can show it always.

**Rise block templates / H5P reuse / Classroom "reuse post"** — all **copies**. H5P's Reuse button = "Download .h5p" or "Copy content" (paste works only within one site). Classroom's reuse dialog has one checkbox, *"Create new copies of all attachments"* (default on) — teachers are widely advised to turn it **off** because it breeds same-named duplicates in Drive. **[S]** [H5P](https://help.h5p.com/hc/en-us/articles/7506823852317-Download-or-Copy-H5P-Content-Using-the-Reuse-Button), [Classroom help](https://support.google.com/edu/classroom/answer/6272593), [Keeler](https://alicekeeler.com/2015/08/28/google-classroom-uncheck-duplicate-attachments/)
→ A single, explicit **reference-or-copy** choice at the moment of reuse, with the *safe* default, is the whole UX.

### 3.3 Pools of raw sources

| Tool | Capture | What an item shows | Used / unused | Reference vs copy | Rot / staleness |
|---|---|---|---|---|---|
| **NotebookLM** | Left **Sources** panel: "+ Add" (upload, Drive, **website URL**, **YouTube URL**, pasted text) and **Discover** (describe a topic → result list with title, one-line relevance note, link → tick several → **Import**). 50 sources/notebook free, up to 600 paid; 500k words/source. | Title + type icon + **checkbox** (tick = in scope for chat/generation); opening a source shows an auto "source guide" (summary + key topics). Answers carry **numbered citations that jump to the passage**. | Checkbox = "in play", not "used". | URL and PDF = **static snapshot at import**; Google Docs/Slides follow the original (auto-sync from May 2026; earlier a manual "Click to sync with Google Drive", shown only if you have write access). | Lose Drive access → source becomes inaccessible. Web sources never refresh. **[S]** [Google blog: Discover](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-discover-sources/), [Workspace Updates 2026-05](https://workspaceupdates.googleblog.com/2026/05/keep-your-sources-up-to-date-with-automatic-Drive-syncing-in-NotebookLM.html), [help](https://support.google.com/gemininotebook/answer/16215270) |
| **Are.na** | "Connect" button on anything; paste a URL into a channel; extension. | Block types: file, **URL** (page, YouTube, SoundCloud), text. For a URL it will "extract the text of the page, take a screenshot". | A block lists every channel it is connected to — *"a public block accumulates context over time"*. | **Pure reference**: one block, many channels ("connections"); nothing is duplicated. Channels can nest. | Screenshot + extracted text survive the page. **[V]** [blocks](https://help.are.na/docs/getting-started/blocks), **[S]** [connections](https://help.are.na/docs/getting-started/connections) |
| **Zotero** | Browser connector; site **translators** pull typed metadata (author, date, publication), falling back to embedded metadata; pick target collection + tags in the save popup. | Typed item with **child items**: snapshot, notes, attachments. | — | One item in **many collections** (reference); "related items" links. | Optional **snapshot** on save ("a locally stored copy of a web page in the same state as when it was saved"). **[S]** [Zotero docs](https://www.zotero.org/support/adding_items_to_zotero) |
| **Raindrop.io** | Extension, share sheet, paste. | Cover, title, excerpt, domain, **type** (link/article/video/image/document/audio), tags, note, highlights; filter by tag/type/attributes. | — | One collection per bookmark. | **Web archive** (Pro): every save is archived in the background — text, images, formatting; *no* video/audio; **YouTube transcripts are extracted and stored**; a filtered view lists failed archives. Separate **broken-link** and **duplicate** detectors. **[V]** [web archive](https://help.raindrop.io/permanent-copy), [help index](https://help.raindrop.io/llms.txt) |
| **Readwise Reader** | Extension sends the **rendered DOM**, not the bare URL → "highest quality parsing"; URL-only saves parse worse. | Parsed article, tags, highlight count, notes. | — | copy | Parsed copy is the archive. **[S]** [saving](https://docs.readwise.io/reader/docs/saving-content), [parsing FAQ](https://docs.readwise.io/reader/docs/faqs/parsing) |
| **Milanote** | Web clipper drops everything into the board's **"Unsorted" column**; or drag out a Link card, paste, Enter. | Link card = **preview image + URL + description, each editable and hideable**; drag a new image over the thumbnail to replace it. Live embeds for YouTube, Vimeo, SoundCloud, Maps, CodePen, Airtable… | Spatial: Unsorted tray vs placed on the board. | copy | — **[V]** [links](https://help.milanote.com/en/articles/1722065-links), **[S]** [clipper](https://help.milanote.com/en/articles/1015930-milanote-web-clipper-for-chrome) |
| **Miro / Padlet** | Paste a URL → preview object. Padlet lets the poster **change the thumbnail** of a link post. | card | spatial | copy | — **[S]** [Miro](https://help.miro.com/hc/en-us/articles/360017572354-Internal-and-external-linking), [Padlet](https://padlet.help/l/en/article/x0kiejkh1q-change-preview-image-for-a-post) |
| **Notion** | Paste URL → choose **mention** (inline chip) / **bookmark** (static card: title, description, image) / **embed** (live iframe). Web Clipper → row in a database; adds a **URL property** automatically, leaves every other property empty. | DB row with whatever properties you define (Status select, tags multi-select, relation). | **Relation + rollup**: a "Used in lessons" relation on the source row, count rollup = usage. **Backlinks** list pages that mention a page. | **Linked database view** = a filtered *window* onto one database (reference; edits go both ways). **Synced block** = same block in many places (live). Duplicate = copy. | none. **[S]** [Notion: embeds, bookmarks, mentions](https://www.notion.com/help/embed-and-connect-other-apps), [web clipper](https://www.notion.com/help/web-clipper), [links & backlinks](https://www.notion.com/help/create-links-and-backlinks) |
| **Gamma / Rise AI / H5P Smart Import** | "Import → paste a link" as *generation input*; the link is consumed, not kept. | — | — | copy | — (see §2.1) |

Course creators who plan in Notion converge on the same schema: a **Lessons database with a Status select** (Not started → Scripting → Recording → Editing → Published) and a related **Resources** database. **[S]** [Ruzuku guide](https://www.ruzuku.com/learn/tools/notion/course-content-tracker) — i.e. people already hand-build this pool because their course tool lacks one. **[I]**

### 3.4 What metadata is captured on a URL

| Source | Fields |
|---|---|
| **oEmbed** ([spec](https://oembed.com/)) **[V: well-known spec; fields confirmed via search]** | `type` (photo / video / link / rich), `title`, `author_name`, `author_url`, `provider_name`, `provider_url`, `thumbnail_url` (+w/h), `html` (for video/rich), `width`, `height`, `cache_age`. Found by provider registry or `<link rel="alternate" type="application/json+oembed">` discovery. |
| **Open Graph** ([ogp.me](https://ogp.me/)) | required `og:title`, `og:type`, `og:image`, `og:url`; useful `og:description`, `og:site_name`, `og:locale`, `og:video`, `og:audio`, `article:published_time`, `article:author`. |
| **Fallbacks** | `<title>`, `<meta name="description">`, `<link rel="canonical">`, favicon, `twitter:*`, JSON-LD (`Article`, `VideoObject.duration`, `transcript`). |
| **What the products add** | Are.na: screenshot + extracted text. Raindrop: type classification, archive, YouTube transcript. Zotero: typed bibliographic fields + snapshot. Readwise: full parsed body. Milanote/Padlet: **user may override image and description**. NotebookLM: generated summary + key topics. |

**Resolution order that works [I]:** canonical URL → oEmbed (if the host is on an allow-list: YouTube, Vimeo, SoundCloud, Spotify…) → Open Graph → `<title>`/description → bare hostname. **Always let the author overwrite title, note and image**; store `fetched_at` and the HTTP status.

**Security — unfurling is server-side fetching of a user-supplied URL = SSRF.** OWASP: allow `http/https` only; resolve DNS and refuse private, loopback, link-local and metadata ranges *after* resolution and again on every redirect; cap redirects, response size and time; never forward cookies; do not fetch the image — store its URL, or proxy it through the existing media route. **[V]** [OWASP SSRF cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). On this host Postgres, Redis, PostgREST and Realtime listen on 127.0.0.1 and Nextcloud/GoTrue are on `eac-network` — an unguarded unfurler in a container could reach them. This is the one place in the pool where a shortcut is dangerous. **[I]** — `packages/lms/src/unfurl.ts` follows these rules (see §3.7 for two small residuals).

### 3.5 Used / unused, reference vs copy, rot, permissions, tagging — how they answer

| Question | Best existing answer | Who |
|---|---|---|
| Is this item used? Where? | A **Usage** column: count, linking to the list of places. Plus **Last used**. | Moodle question bank |
| | A block lists every channel it is connected to. | Are.na |
| | Relation + rollup ("Used in"). | Notion |
| | Spatial: an **Unsorted** tray that empties as you place things. | Milanote |
| Reference or copy? | Reference pinned to a version, with **Update available → Before/After → Accept / Ignore**, and **Unlink** to turn it into a local copy. | Open edX v2 |
| | Pin a version *or* "Always latest", per use. | Moodle question bank |
| | Copy with an *Updates* tab (notification only reaches the importer — a known flaw). | Canvas Commons |
| | Pure copy; template itself immutable. | Rise, H5P, Classroom |
| Link rot | Archive at save (text + images; transcripts for YouTube); list of failed archives; broken-link detector. | Raindrop |
| | Screenshot + extracted text. | Are.na |
| | Snapshot as a child item. | Zotero |
| | On-demand validator that also flags *links to unpublished internal content*. | Canvas |
| | Scale of the problem: 38% of pages that existed in 2013 were gone by Oct 2023; 8% of 2023 pages gone within the year; 23% of news pages carry a dead link. | **[V]** [Pew, 2024-05](https://www.pewresearch.org/data-labs/2024/05/17/when-online-content-disappears/) |
| Permissions | Only *published* library content may be pulled into a course; library roles separate from course roles; public-read libraries. | Open edX |
| | Listed / unlisted per item; manage-own vs manage-any. | Moodle content bank |
| | Usage rights required before publish. | Canvas Files |
| | Source becomes inaccessible if you lose access upstream. | NotebookLM |
| Tagging | Collections (curated subsets) **and** taxonomy tags that travel with the content. | Open edX |
| | Free tags + type filter. | Raindrop, Zotero |
| | Most *project-scoped* pools have **no tags at all** (NotebookLM, Milanote) — the pool *is* the tag. | |

### 3.6 What this means for Sophia specifically **[I]**

- Our pool items are of two very different natures. A **thread** is a first-party row we can always re-read: reference is free and its status is knowable (`status`, `visibility`, `updated_at`). A **URL** is third-party: we can only hold what we captured. So: **threads = live reference; URLs = metadata snapshot at capture, re-checkable**.
- **Usage is derivable, not stored** at our scale (tens of steps). Moodle stores it because it has millions of rows.
- **Permission trap:** a `public` course must not quietly point learners at a members-only or INVITE_ONLY thread. Say so at *capture* time, again on the outline row, and again at publish. (Memory note *threads is a shared namespace*: forum queries let own-author and admin bypass `visibility`, so "I can see it" ≠ "learners can".)
- The pool is also the **AI seam** (rule 10) and the **"republish a past workshop as a course"** seam (pool the workshop's session threads + recordings → "make a step from each").

### 3.7 The pool we built today, measured against the patterns

*Read: `packages/db/migrations/145_lms_course_pool.sql`, `packages/lms/src/pool.ts`, `packages/lms/src/unfurl.ts`, `StudioPoolPage` in `packages/lms-ui/src/studio.tsx`, `steps/StepBody.tsx`.* **[V]**

**What it is.** `lms_pool_items` per course: kinds `thread | url | media | note`; captured title / description / image / site name; author's note; free tags; `added_by`; soft-archive; unique per course on thread and on URL. **One box** takes a forum link or thread id, any URL (unfurled), or plain text (becomes a note). Also *Search the network's threads* and *Browse the org's files*, each with an "in the pool" chip on hits already gathered. Rows show kind · org · thread kind / site name, the note, tags, **"Used in ‹step links›" or "Not used yet"** (derived from the working outline's drafts), "This thread has gone", and a "Not public" warning. **Use in…** select = a new step in module X (kind chosen for you: `session` for meeting/workshop/event/reading_group threads, `thread`, `resource`, `practice` for audio/video, `reading` for a note) *or* attach to an existing step. The step editor links to the pool with `?for=<step>` so the select is pre-aimed, and lists "Links from the pool" with remove checkboxes. Learner pages render pooled links as a plain "Further reading" list — no third-party images reach learners. The unfurler is SSRF-guarded: http(s) only, default ports, no credentials, every hop resolved and refused if any address is private, manual redirects (max 3), 4 s, 512 KB, HTML only, and it never fails the add.

| Pattern (from §3.2–3.5) | Best-in-class | Our pool | Verdict |
|---|---|---|---|
| One capture box, type detected | NotebookLM, Milanote | yes — and it also takes notes, which NotebookLM/Raindrop do not | **ahead** |
| Find first-party content without leaving | Open edX library picker | network thread search + org file browser, with "in the pool" chips | **ahead** of the raw-source tools |
| Dedupe on capture | Raindrop | yes (thread id; *final* URL after redirects) — but no canonicalisation, so `?utm_…`, `#fragment`, trailing slash, `m.`/`www.` make duplicates | partial |
| Used / unused, with links to where | Moodle Usage column, Notion rollup | yes, derived, links to each step; "Not used yet" filter | **matches** — but see gap 3 |
| Reference, not copy | Are.na, Open edX | thread = live reference; URL metadata is *copied into the step's refs at use time* (correct: published versions must be immutable) | **right** |
| "Changed upstream since you placed it" | Open edX *Update available*; Moodle *Always latest vs pinned* | none. A thread can be retitled, rescheduled or rewritten and neither pool nor outline says so | **missing** |
| Gone / not public | Canvas link validator (on demand) | always-on for threads in the pool row | **ahead** for threads; **missing** for URLs |
| Link rot for URLs | Raindrop archive + broken-link view; Zotero snapshot; Are.na screenshot+text | captured title/description/image only. No `fetched_at`, no `http_status`, no re-check, no archive | **missing** |
| Editable card (title / description / image) | Milanote, Padlet | only note + tags are editable. A page with a bad `<title>` (or an unfurl that fell back to the hostname) is stuck with it, and the bad title is what gets copied into the step | **missing** |
| Rich metadata (type, author, duration, embed html) | oEmbed; Raindrop type; Zotero translators | OG/Twitter/`<title>` only. No oEmbed, no `og:type`/`og:video`, no `rel=canonical`, no JSON-LD. A YouTube/Vimeo/SoundCloud link lands as a generic `url` → `resource` step rather than playable media | **missing** (allow-listed oEmbed would fix it) |
| Capture where you already are | Are.na "Connect", Zotero connector, Milanote clipper | only from inside the pool page | **missing** — an "Add to a course's pool" action on the forum thread popup is the big one |
| Inbox vs placed | Milanote "Unsorted" | "Not used yet" filter; no "Needs a look" (gone / not public / dead link / changed) filter; tag and unused filters cannot combine; no kind filter | partial |
| Organising | Open edX collections + tags | free tags (≤ 12, lower-cased) with chips. No manual order, no grouping by module/week | fine for now |
| Surfacing problems at publish | Canvas validator; Open edX publish chip | nothing from the pool reaches the publish panel or the outline rows | **missing** |
| Permissions | Open edX: only what you may read, only published | **gap:** `addToPool` looks a pasted thread id up with `SELECT id, title, excerpt FROM threads WHERE id = …` and no visibility check, so a course author can capture the title + excerpt of a thread they cannot see (another org's INVITE_ONLY thread, a draft). Search goes through `c.searchThreads(q, viewer)` and is fine; the paste path is not | **fix first** |
| Replace vs add | Podia/Open edX ask where | attaching a thread to a step that already has `refs.threadId` **overwrites it silently** | small bug-shaped gap |
| Pool travels with the course | — | no course-duplicate yet, so moot; remember it then | later |
| Body-text usage | Notion backlinks | usage only looks at `refs.threadId / links / media`; a URL the author pasted into `bodyHtml` still reads "Not used yet" | minor |

**Residual unfurl notes [I]:** the guard resolves the host and then `fetch` resolves it again (a DNS-rebinding window; small, and the response is only parsed for meta tags, but pinning the resolved IP would close it); the loop allows 4 fetches where the comment says max 3 redirects; the `</head>` early-exit tests each chunk separately, so a tag split across chunks just reads on to the cap — harmless. `image_url` is shown to the *author* hot-linked with `referrerPolicy="no-referrer"`; acceptable, and learners never load it.

**So what is the minimal good version?** One per-course table of *references*; one paste box that tells a first-party thread from a web link; a guarded unfurl whose result the author can correct; usage derived from the drafts; four visible states — *unused · used in N (linked) · changed · gone / not public*; two verbs — *make a step from this* and *use in step…*; and the same warnings repeated at publish. No tags, collections, archive, extension, board view or AI are needed for it to be good. **The built pool already covers all of that except "author can correct", "changed", "gone" for URLs, and the echo at publish** — and it adds notes, tags, network search and a file browser beyond the minimum. **[I]**

**What it is missing, in order:**
1. **Visibility check on the paste path** (use the same viewer-scoped read the search uses; if unreadable, say "you can't see that thread").
2. **Editable title / description** on a pool item (and "re-fetch").
3. **`fetched_at`, `http_status`, `checked_at`** + a re-check (on demand from the pool page first; scheduled later) → a `gone` chip for URLs like the one threads already have.
4. **"Changed since you placed it"** for threads: compare `threads.updated_at` (and `scheduled_at` for sessions) with the step draft's last save; show on the pool row *and* the outline row.
5. **A "Needs a look" filter** (gone · not public · dead · changed) and let filters combine.
6. **Pool problems in the publish panel**: "2 steps point at threads that aren't public", "1 link didn't answer".
7. **Allow-listed oEmbed** (YouTube, Vimeo, SoundCloud, Spotify) → `media_kind` + provider + duration, so "Use in → new step" makes a playable practice/resource, and URL canonicalisation (`rel=canonical`, strip `utm_*`/fragment) before the dedupe.
8. **Capture from the forum**: "Add to a course's pool" on the thread popup, for anyone who can edit a course.
9. **Confirm before replacing** a step's existing thread ref.
10. Later: Wayback *Save Page Now* for URLs that end up *used*; bulk "make a step from each selected"; copy the pool when a course is duplicated; count links found in `bodyHtml` as use.

---

## 4. Copy, avoid, and ten improvements

### 4.1 Copy (cheap, high value)

| Pattern | From |
|---|---|
| Three-state chip per outline row: never published · published · published with pending edits | Open edX |
| "Move to…" as the accessible twin of drag | Moodle, Canvas |
| Duplicate with a destination picker; always a copy | Podia, Thinkific |
| Preview draft *vs* view live | Thinkific |
| Usage count linking to where; last used | Moodle question bank |
| Reference + "you should look at this" rather than auto-sync | Open edX v2 |
| Sources panel, one paste box, dedupe | NotebookLM, Raindrop |
| Editable link card (title, note, image) | Milanote, Padlet |
| A11y rules run over saved HTML (alt, alt=filename, heading skips, adjacent links, list markup) | Canvas RCE |
| Local-storage draft restore | Canvas RCE |
| Staff-only notes per step | Frappe LMS |
| Sources → outline approval → draft, if AI ever ships | Rise AI course drafts |

### 4.2 Avoid

| Anti-pattern | Seen in | Why |
|---|---|---|
| Four overlapping reuse mechanisms | Canvas (Files, Commons, Blueprint, course copy) | Nobody can explain which to use. One pool, one verb. |
| Push-sync from a master with locks | Canvas Blueprint | Institutional problem; our versions + explicit adopt already cover it. |
| Copy-by-default with silent duplicates | Classroom "create new copies" | Default to reference for first-party things. |
| Update notice only to whoever imported | Canvas Commons | State belongs on the item, visible to every author of the course. |
| A free block canvas for learner pages | Rise, LearnHouse, Gamma | Costs us no-JS rendering, SEO structure and the named practice/alternative/prompt fields. |
| Prompt → generic outline generators | Thinkific, Teachable, Kajabi | Output is interchangeable; ours is a lineage teaching. |
| Bulk mode, column pickers, taxonomies | Moodle | Right at 10,000 courses, noise at 5. |
| Unfurling without SSRF guards | any naive implementation | See §3.4 — our internal services are reachable from a container. |
| Live iframes of third-party pages in steps | Notion embed | Breaks (X-Frame-Options), tracks learners, rots silently. Cards + oEmbed allow-list only. |

### 4.3 Ten improvements for the studio, in priority order

Ranked with the pool (§3.7) already built. Pool follow-ups are grouped so they do not crowd out the rest of the studio.

| # | Improvement | Borrowed from | Why this rank | Size **[I]** |
|---|---|---|---|---|
| 1 | **Close the pool's paste-path leak and the silent thread-ref overwrite**: viewer-scoped thread read in `addToPool`; confirm before replacing a step's existing thread. | Open edX (only content you may read can be pulled in) · Podia (ask where) | Correctness before features; both are a few lines. | XS |
| 2 | **Preview as a learner** from the step editor and outline: render the *draft* through the real learner page, banner "Preview — not published", with a "view live" twin. | Thinkific (drafts vs published) · Rise · Mindsmith ▶ | Today an author must publish to see the page. Highest friction left in the studio. | S–M |
| 3 | **Per-row state in the outline**: "new" · "edited since publish" · "unchanged", plus warnings carried from the pool/refs — `thread gone`, `not public`, `thread changed`, `no transcript`. | Open edX status chip + *Update available* | The publish panel already computes the diff; authors scan rows, not panels. Also gives the pool's signals somewhere to land. | S |
| 4 | **Pool health**: `fetched_at` / `http_status` / `checked_at`, a "check links" button (then a schedule), "changed since you placed it" for threads, a **Needs a look** filter, combinable filters. | Raindrop broken links · Canvas validator · Moodle *Last used* · Open edX sync | Turns the pool from a list into something that protects a public course over years (Pew: 8% of pages die within a year). | M |
| 5 | **Editable pool cards + allow-listed oEmbed + URL canonicalisation**: fix a bad title once, before it is copied into steps; YouTube/Vimeo/SoundCloud links arrive as playable media with provider and duration; `utm_*`/fragment stripped before dedupe. | Milanote / Padlet link cards · oEmbed · Raindrop types | Most web links a contemplative teacher gathers *are* talks and recordings. | M |
| 6 | **"Move to…" and Duplicate** on steps and modules: one select (module + position); "Duplicate to… this course / another of my courses". | Moodle Move dialog · Podia duplicate | ↑/↓ across modules is slow; duplicate is how week 2 gets built from week 1. No JS needed. | S |
| 7 | **Publish checks** (server-side over saved HTML + refs), listed in the publish panel and on rows: missing summary, media without transcript, image without alt / alt = filename, skipped heading levels, adjacent duplicate links, thread not public, link not answering. Warn; block only "non-public thread in a public course". | Canvas RCE a11y checker · Canvas link validator | WCAG 2.2 AA and transcripts are already house rules; this enforces them without a client-side checker. | M |
| 8 | **Capture from the forum**: "Add to a course's pool" on the thread popup for anyone who can edit a course; then the same on blog posts and meetings. | Are.na *Connect* · Zotero connector · Milanote clipper | Capture friction decides whether a pool gets used; authors meet the material in the forum, not in the studio. | S–M |
| 9 | **Step blueprints**: "Start from…" on Add step — 5–6 copy-templates per kind (*Sitting practice with alternative*, *Reading + one question*, *Live session with prep*), and "Save this step as a blueprint". Copies, never linked. | Rise block templates · Mindsmith page templates | SYNTHESIS Phase 3 asks for blueprints; this is the smallest form, and it is what founding teachers will need first. | S–M |
| 10 | **Don't-lose-my-work + notes for guides**: local-storage restore of unsaved editor fields, a visible "Saved 14:02", `beforeunload` when dirty (all progressive — forms still post without JS); a staff-only "Notes for guides" field per step shown on the guide desk, never in public HTML or JSON-LD. | Canvas RCE autosave · Thinkific autosave · Frappe instructor notes | A long practice text lost to a back-swipe loses a teacher; guide notes serve the feature SYNTHESIS says matters most. | S |

**Parked on purpose:** drag-and-drop (enhancement over #6), bulk mode, collections / a cross-course library, comments/review threads, AI drafting from the pool (the pool makes it possible; rule 10 says drafts-only and opt-in), browser extension, URL archiving beyond Save-Page-Now.

---

## 5. Verification notes

- **Read directly today [V]:** Moodle docs (course/view 4.5, Content bank 4.5, Question bank 5.0); Open edX docs (sync a library update, add library content, library homepage) and `openedx/end-to-end-tests#78`; LearnHouse blocks doc; Frappe LMS lesson doc; Articulate support (block types, block templates, AI course drafts); Mindsmith Editor 101; Are.na blocks; Raindrop web archive + help index; Milanote links; OWASP SSRF cheat sheet; Pew link-rot report; our own `studio.tsx` (incl. `StudioPoolPage`), `types.ts`, `refs.ts`, `pool.ts`, `unfurl.ts`, `steps/StepBody.tsx`, migration 145. The pool was read, not run.
- **Search-summary only [S]:** everything about Thinkific (help centre returns 403 to fetchers), Teachable, Kajabi, Podia, Circle (page body did not load), Skool, Mighty, Maven, Canvas (Instructure community pages summarised via university KBs), NotebookLM, Notion, Zotero, Readwise, Gamma, H5P, Coassemble, Courseau, Moodle 5.1 activity chooser and AI subsystem. Treat UI labels in those rows as indicative.
- **Not verified:** exact Open edX wording for "unlink" / "keep course content" in the UI (taken from test descriptions); whether Open edX shows a per-item "used in N courses" count in the library sidebar (I found no doc saying so — assume not); Rise 360 source-file limits; any hands-on behaviour — no product was operated, only documented.
- No screenshots were captured; all UI descriptions are from documentation text.
