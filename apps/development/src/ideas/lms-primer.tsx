import "./pickers-in-puck.css";
import type { Idea } from "./types";

// A plain-language primer. Source of truth for the words: docs/open/DEVELOPMENT_APP_2026-11-20/lms-primer.md.
// Written from the code on 2026-11-22; nothing here was run in a browser.

const STEPS: { kind: string; does: string; stored: string }[] = [
  { kind: "Reading", does: "Reads, watches or listens, then presses \"I've taken this in\".", stored: "That it was done." },
  { kind: "Practice", does: "Does or notices something, presses \"I did the practice\"; may add a note.", stored: "That it was done, plus an optional practice log." },
  { kind: "Reflection", does: "Answers one question in a box (\"never graded\"). Keeping it completes the step.", stored: "The written answer." },
  { kind: "Gathering", does: "Goes to a live meeting or workshop that already exists, presses \"I was there\".", stored: "That it was done, plus an optional reflection." },
  { kind: "Conversation", does: "Reads and joins a forum thread, presses \"I've joined the conversation\".", stored: "That it was done. The posts live in the forum, not the journal." },
  { kind: "Resource", does: "A file or link to keep, presses \"Seen\". Usually optional.", stored: "That it was seen." },
  { kind: "Something to set up", does: "Does a real thing on the network (profile, page, store, organisation). Ticks itself when the platform sees it exists; can repeat daily.", stored: "Nothing new. The platform answers each time." },
];

const VIS: { who: string; sees: string }[] = [
  { who: "Me", sees: "Only the author." },
  { who: "My guide", sees: "The guide or guides named on that run." },
  { who: "My circle", sees: "The other people enrolled in the same run, plus its guides." },
  { who: "Public", sees: "The open web. Allowed only on a public course." },
];

const WORDS: { workshop: string; lms: string; status: "Exists" | "Partly" | "New"; note: string }[] = [
  { workshop: "Workshop / workspace", lms: "Course, plus one run tied to the workshop", status: "Exists", note: "" },
  { workshop: "Session", lms: "Module", status: "Partly", note: "A module is only a title and a summary: no date, colour, cover or materials." },
  { workshop: "Step", lms: "Step", status: "Exists", note: "Seven kinds. No photo, recording or quiz." },
  { workshop: "Participant", lms: "Enrolment in the run", status: "Exists", note: "" },
  { workshop: "Guide", lms: "Named guide on the run", status: "Exists", note: "" },
  { workshop: "Group of participants", lms: "The run (kind \"together\" or \"circle\")", status: "Exists", note: "" },
  { workshop: "Ongoing session (repeats weekly)", lms: "Nothing", status: "New", note: "A step happens once per person." },
  { workshop: "Interval (day, week)", lms: "Unlock by date, or by days after start, per step", status: "Partly", note: "No week heading or grouping." },
  { workshop: "Pinned material", lms: "A step's media and links, resource steps, the course pool", status: "Partly", note: "A module has no materials of its own." },
  { workshop: "Journal entry", lms: "Reflection, practice log or note", status: "Partly", note: "Text only." },
  { workshop: "Private journal", lms: "Visibility \"my guide\" (or \"me\")", status: "Exists", note: "" },
  { workshop: "Shared journal (Concurrent)", lms: "Visibility \"my circle\"", status: "Partly", note: "Shown one step at a time; no group-wide feed." },
  { workshop: "Guide comment", lms: "A guide's answer (acknowledgement), text or audio, emailed", status: "Exists", note: "" },
  { workshop: "Peer comment", lms: "Nothing", status: "New", note: "Only a guide can answer an entry." },
  { workshop: "Pacing", lms: "Unlock rules", status: "Exists", note: "" },
  { workshop: "Deadline", lms: "Nothing", status: "New", note: "Only \"opens on\", never \"closes on\"." },
  { workshop: "Timer, time limit", lms: "Nothing", status: "New", note: "Only an estimate in minutes." },
  { workshop: "Talk room / Zoom link", lms: "Lives on the workshop; the run points at it", status: "Exists", note: "On the workshop side." },
  { workshop: "RSVP brings people in", lms: "A \"Bring in everyone who RSVP'd\" button", status: "Partly", note: "Manual: a guide must press it each time." },
  { workshop: "Group conversation", lms: "A forum thread per step, per run", status: "Exists", note: "" },
  { workshop: "Notify when someone posts", lms: "Only the \"your guide answered\" email", status: "New", note: "" },
  { workshop: "Done / progress", lms: "Step state, course completion, award", status: "Exists", note: "" },
  { workshop: "The sheet beside the page", lms: "Nothing", status: "New", note: "Learner screens are one page per step." },
  { workshop: "Who is online", lms: "Nothing", status: "New", note: "" },
];

const GROW: string[] = [
  "A group-wide read: everything the group shared, newest first, filtered by person or week. Today it is one step at a time. No new table.",
  "A \"space\" step kind to carry the weekly page (pinned material, the group feed). A registration, no migration.",
  "Module extras: a date, a materials list, a cover and a colour. The outline is stored as JSON, so this is additive.",
  "Peer comments on a shared entry. A new table; today only a guide can answer.",
  "Deadlines and timers. Soft \"suggested by\" dates fit in step settings; a real timer needs one small column to remember the start.",
  "Entry kinds beyond text: photo, recording, quiz answers. The stored kind is limited to three values, so this needs a migration.",
  "RSVP to enrolment automatically (today it is a button).",
  "Notifications, ideally a digest. Today only the guide-answered email.",
  "Creating the workshop and its course together in one action.",
  "Embeddable parts: the learner screens are whole pages that post forms, so a sheet beside a page needs reusable parts, or the engine's functions called directly.",
];

const UNVERIFIED: string[] = [
  "Nothing was run in a browser. \"Exists\" means the code is there and wired, not that it was seen working signed in.",
  "Counts come from a SELECT on the database named elkdonis_dev, taken to be the live data: 29 courses, 178 steps, 29 runs (26 automatic always-open, 3 groups), 10 enrolments, 11 written entries (9 to a guide, 2 only-me, none shared with a circle), 5 guide answers. No learner's text was read.",
  "What other sites do with the engine beyond the stand-up plan was not checked. innergathering does not use it.",
  "That \"Bring in everyone who RSVP'd\" gives working access to a private course was not tested; the code grants access as it enrols.",
  "Who can reach /studio on live Sophia was read from code (owners and guides of an organisation, or a named author), not tried.",
];

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="pkr-scroll">
      <table className="pkr-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LmsPrimer() {
  return (
    <div className="pkr">
      <p className="dev-lede">
        A plain account of how the learning system works today, checked against the code on 2026-11-22. Nothing here is built new; it is the starting point for deciding how workshops and workspaces should sit on it.
      </p>

      <h2>In one paragraph</h2>
      <p>
        The learning system is a shared engine that holds courses, the people taking them, and what those people write along the way. <strong>Sophia</strong> (sophia.arts-collective.com) is its full home: a visitor browses
        courses, a learner takes them and keeps a journal, a guide answers what people choose to show them, and an author builds and publishes in a Studio. <strong>arts-collective.com/learn</strong> shows the same learner
        screens inside the network's own page. <strong>The dock</strong> follows one course step at a time and can do what a step asks (for example set up your profile) and tick it off. The dock and the assistant read who is
        enrolled and which steps are done; they do not read anyone's journal. It is already in real use: 29 courses, 178 steps, 10 enrolments and 11 things written by learners.
      </p>

      <h2>The pieces</h2>
      <p>
        <strong>Course.</strong> A named thing to take, belonging to one organisation, free to the learner. Private until the author says otherwise. Authors write a draft; nothing reaches a reader until they{" "}
        <strong>publish</strong>, which freezes a numbered version. People part-way through are never locked out by a later change.
      </p>
      <p>
        <strong>Module.</strong> A chapter: a titled, ordered list of steps. It has a title and a short summary and nothing else. No date, no colour, no cover, no materials of its own.
      </p>
      <p>
        <strong>Step.</strong> One thing to do, with text, optional media (with a transcript), links and a time estimate. Seven kinds exist. A new kind is a small registration plus a screen, with no database change: the cheapest
        way the system grows.
      </p>
      <Table head={["Step kind", "What the learner does", "What gets stored"]} rows={STEPS.map((s) => [s.kind, s.does, s.stored])} />

      <p>
        <strong>Run (a course offered to a group, with dates).</strong> Everyone can always take a published course alone, at their own pace; that is an automatic always-open run. A <strong>run</strong> is a named group
        walking the course together. It has a name, a kind (together with a guide, a peer-led study circle, or at their own pace a little at a time), a start and end date, a number of places, who may join (anyone allowed, or
        only people the guide brings in), named guides, an optional tie to a workshop, and the starting privacy for what people write. A run stays on the version it opened with until its guide moves it forward.
      </p>
      <p>
        <strong>Enrolment.</strong> A person's seat in one run: active, paused, completed or withdrawn, with the date their clock starts from and the last step they were on. Pressing Begin on a course page enrols you in the
        always-open run; a guide can bring people into a group run.
      </p>
      <p>
        <strong>What a learner writes, and who can read it.</strong> Three kinds are stored: a reflection, a practice log, and a note to the guide. Each is text (up to 20,000 characters) and carries its own visibility, chosen
        when written.
      </p>
      <Table head={["Visibility", "Who can read it"]} rows={VIS.map((v) => [v.who, v.sees])} />
      <p>
        A note to the guide is always guide-only. The run's setting only supplies the starting choice. Deleting is real: the words are gone, and the activity log keeps only that something was written and how widely. An
        organisation's owners can manage a run but do not read journals through that role alone; only guides named on the run do.
      </p>
      <p>
        <strong>A guide's answer.</strong> A guide reads what people showed them (a "To answer" list in the journal page) and replies in words or an audio link. The learner is emailed. It is the only email the learning system
        sends.
      </p>
      <p>
        <strong>Unlock rules (pacing).</strong> Each step carries one of five rules: after the previous required step (the default), always open, after another module is done, on a calendar date, or a number of days after the
        person's start (a group's start date, for a group). That is all the pacing there is; there is no separate weekly or interval setting. Something already begun is never locked again.
      </p>
      <p>
        <strong>Awards.</strong> One thing earns one today: finishing a course. It shows on the journal page, beside an 84-day practice calendar.
      </p>
      <p>
        <strong>Tasks.</strong> Steps of the "something to set up" kind are the link to the rest of the platform. The dock shows them and can run the action behind them.
      </p>
      <p>
        <strong>Pool and refs.</strong> The <strong>pool</strong> is an author's scratch shelf for a course: pasted links, forum threads, files and notes, tagged, each turned into a step in one click. Learners never see it.{" "}
        <strong>Refs</strong> are what a step points at on the rest of the network (a workshop, a meeting, a forum thread); the engine reads them and never owns them.
      </p>

      <h2>Is there already a "work group"?</h2>
      <p>
        <strong>In outline yes; in the shape you drew, no.</strong>
      </p>
      <p>What a run gives you today:</p>
      <ul>
        <li>A named group with start and end dates, places and a guide.</li>
        <li>A way to bring people in: open, by invitation, or everyone who said yes to a workshop.</li>
        <li>Writing that starts as "my circle", so the group can read each other's reflections on a step.</li>
        <li>A forum conversation per step, opened with one button if the run has a forum category.</li>
        <li>One course everyone follows, with each person's progress visible to the guide.</li>
      </ul>
      <p>What it does not give you:</p>
      <ul>
        <li>
          <strong>A shared feed per interval.</strong> The group's shared writing appears one step at a time, at the bottom of a step. There is no "everything the group wrote this week", and that panel leaves out notes.
        </li>
        <li>
          <strong>A repeating step.</strong> A step happens once per person. Only platform set-up steps can repeat daily, and they are not a place to write.
        </li>
        <li>A page for the group as a place: a home, a roster learners can see. Guides see a roster; learners do not.</li>
        <li>Peer comments (only a guide answers), deadlines, timers, and any message when someone posts.</li>
      </ul>
      <p>
        So a workshop with a group is a course plus one run, and that works now. A weekly shared journal with pinned material and a feed is the missing layer on top.
      </p>

      <h2>A walk-through</h2>
      <h3>Making a course today, as an author on Sophia</h3>
      <p>You must be an owner or guide of an organisation, or a named author on the course. Otherwise Studio does not appear.</p>
      <ol>
        <li>
          <code>/studio</code>: "Your courses". A form at the bottom, "Start a course": title, one line (who it is for and what changes), and which organisation. It starts private.
        </li>
        <li>
          <code>/studio/&lt;course&gt;</code>: the course desk. Edit the title, address, summary, description and who can see it. Add modules and steps (add, rename, remove, move). Set each step's unlock rule here.
        </li>
        <li>
          <code>/studio/&lt;course&gt;/&lt;step&gt;</code>: edit one step: kind, text, media, links, time, the prompt, and for a gathering the workshop it points at (pasted by its forum link).
        </li>
        <li>
          <code>/studio/&lt;course&gt;/pool</code>: optional scratch shelf; add things, tag them, send one to a step.
        </li>
        <li>
          <strong>Publish</strong>, on the course desk. The change is labelled "fix" or "structural". The first publish also creates the always-open run.
        </li>
        <li>
          <strong>Groups</strong>, same desk: "Open a new group": name, kind, start, places, workshop link (optional), forum category (optional). Then add a guide by email, set who joins and the starting privacy, and, if tied to
          a workshop, press "Bring in everyone who RSVP'd".
        </li>
        <li>
          <code>/studio/workshops</code>, <code>/studio/schedule</code>, <code>/studio/guides</code>, <code>/studio/traditions</code>: the hub shelves (which workshops are listed and what stays available after they end, the
          schedule, the guides directory, traditions).
        </li>
      </ol>

      <h3>Taking one, as a learner</h3>
      <ol>
        <li>
          Browse: <code>/</code>, <code>/courses</code>, <code>/inner</code>, <code>/outer</code>, <code>/workshops</code>, <code>/guides</code>, <code>/schedule</code>. Anyone, signed in or not, can read a public course.
        </li>
        <li>
          <code>/&lt;course&gt;</code>: the course page: summary, Begin (needs sign-in; it keeps your place), and "The way through", with "Opens 14 March" on locked steps.
        </li>
        <li>
          <code>/&lt;course&gt;/&lt;step&gt;</code>: do the step, write in the box, choose who can read it (the choices depend on the run), press the done button. In a group run you also see the conversation on this step and what
          others in the circle shared.
        </li>
        <li>
          <code>/journal</code>: everything you wrote, across courses, with who can read each; guides' answers to you; awards; and, for guides, the "To answer" list. The same screens run under{" "}
          <code>arts-collective.com/learn</code>.
        </li>
        <li>The dock, on arts-collective.com only: your current course step and, for set-up steps, an offer to do it.</li>
      </ol>

      <h3>How a run is tied to a workshop</h3>
      <p>
        A workshop is its own thing on the network (a page, sessions, a price, an RSVP list, a video room or a pasted Zoom link). A run points at it. <strong>RSVP to enrolment:</strong> a person says yes (or pays) on the
        workshop page; a guide then presses "Bring in everyone who RSVP'd" on the run; each person gets access to the course and a seat in the group. I checked that this button is the only caller, so{" "}
        <strong>it is manual, not automatic</strong>. Someone who RSVPs tomorrow is not in the run until the next press. The video room stays on the workshop. A run can only be tied to a workshop of the same organisation.
      </p>

      <h2>Workshop words and learning-system words</h2>
      <Table head={["Workshop word", "Learning-system word", "Status", "Note"]} rows={WORDS.map((w) => [w.workshop, w.lms, <strong key="s">{w.status}</strong>, w.note])} />

      <h2>Where should workspaces be created?</h2>
      <p>
        <strong>(a) From each site</strong>, for example <code>/workspace</code> on an organisation's own site.
      </p>
      <ul>
        <li>For you: made where the organisation already lives, next to its workshops, RSVP and price. One more place to learn.</li>
        <li>For the learner: found where they already signed up.</li>
        <li>
          For the build: the first target (innergathering) does not yet use the learning engine and carries many unfinished edits, so a rebuild ships all of them. Every new site repeats the wiring.
        </li>
      </ul>
      <p>
        <strong>(b) Inside Sophia</strong>, as a new kind of course with a <code>/workspaces</code> page.
      </p>
      <ul>
        <li>For you: one desk, the Studio you would already use, with guides, pool and groups. One place to learn.</li>
        <li>For the learner: has to come to Sophia, a different address from the organisation they know. The workshop's own page (price, RSVP, room) stays elsewhere.</li>
        <li>
          For the build: Sophia already has the engine, sign-in, studio and journal, and has no <code>/workspaces</code> route today. But a course has no "kind" field (only an area tag from a fixed list of eight), and creating
          a workshop from Sophia would also have to create the workshop itself, since price, RSVP and room live there. A workspace is not a different kind of course in the data; it is a course with a run tied to a workshop.
        </li>
      </ul>
      <p>
        <strong>(c) Both doors onto one thing.</strong>
      </p>
      <ul>
        <li>For you: one definition (a workspace is a course plus a run tied to a workshop). Create it from Sophia or from a site; it shows in both.</li>
        <li>For the learner: enters from wherever they signed up.</li>
        <li>For the build: the most to describe, the least to repeat, if the creating and the screens are built once and mounted twice.</li>
      </ul>
      <blockquote className="pkr-quote">
        <strong>My pick: (c), built in the order b, then a.</strong> Build the workspace screens and the "create a workspace" action once as a shared piece, and mount it first on Sophia as <code>/workspaces</code>: it already has
        sign-in, the studio, guides and the journal, and no unfinished edits to collide with. Each organisation site then gets a thin <code>/workspace</code> page later that opens the same thing. This differs from the
        stand-up plan, which mounted first on innergathering; I would start on Sophia because of the missing dependency and the risk of rebuilding that site. Settle first who creates the workshop itself (page, price, RSVP): it
        must be one action, not two screens.
      </blockquote>

      <h2>What the learning system would need to grow</h2>
      <p>Checked against the code, in a plausible order.</p>
      <ol>
        {GROW.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ol>
      <p>Not needed to start: presence (who is online), timers, and an AI reading journals (a flag exists but nothing reads it).</p>

      <h2>What I could not verify</h2>
      <ul className="pkr-open">
        {UNVERIFIED.map((u) => (
          <li key={u}>{u}</li>
        ))}
      </ul>
    </div>
  );
}

const idea: Idea = {
  slug: "lms-primer",
  title: "How the learning system works today",
  summary: "A plain primer on courses, runs, journals and pacing; whether a work group already exists; workshop words against learning words; and where workspaces should be created.",
  status: "exploring",
  added: "2026-11-22",
  refs: [
    "docs/open/DEVELOPMENT_APP_2026-11-20/lms-primer.md",
    "docs/open/DEVELOPMENT_APP_2026-11-20/workspace-grounding.md",
    "docs/open/DEVELOPMENT_APP_2026-11-20/workspace-standup.md",
    "packages/lms",
    "packages/lms-ui",
    "apps/sophia",
    "docs/open/mcp-foundations/DOCK_RAILS_PLAN.md",
  ],
  Component: LmsPrimer,
};

export default idea;
