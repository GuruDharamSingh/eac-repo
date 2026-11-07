import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { editingOf, type PuckEditing } from "@elkdonis/blocks/record";
import { roman, STATIC_COURSE, type CourseSummary } from "./course-data";

// ============================================================================
// Course card (he-course): Ario's Sophia course, "Enneagram Foundations".
//
// The title, summary, step count and module list come from the course's
// PUBLISHED version (resolver -> lib/course.ts), so they follow what Sophia
// serves; typed words here override the title and summary. Every link goes
// to the course on the Sophia host. On an editing surface the links are
// inert (a click selects the block).
// ============================================================================

const props = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "Learn", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", description: "Empty = the course's own title.", default: "", inlineEditable: true },
  {
    name: "intro",
    kind: "text",
    label: "Introduction",
    default: "The whole system, taught in order — short steps, a practice in each module, and reflections that stay private to you. Hosted on Sophia, the network’s learning space.",
  },
  { name: "cardTitle", kind: "string", label: "Card title", default: "A free walk through the map" },
  { name: "cardBody", kind: "text", label: "Card text", description: "Empty = the course's own summary.", default: "" },
  { name: "badges", kind: "string", label: "Badges", description: "Comma separated. {steps} = the step count.", default: "Free, Self-paced, {steps} steps, Private reflections" },
  { name: "buttonLabel", kind: "string", label: "Button", default: "Open the course" },
  { name: "showModules", kind: "boolean", label: "List the modules", default: true },
] as const;

type Props = PropsOf<typeof props> & { course?: CourseSummary | null; puck?: PuckEditing };

export function HeCourse(p: Props) {
  const { drawn } = editingOf(p.puck);
  const course = p.course ?? STATIC_COURSE;
  const heading = (typeof p.heading === "string" && p.heading.trim()) || course.title;
  const body = (typeof p.cardBody === "string" && p.cardBody.trim()) || course.summary;
  const badges = (typeof p.badges === "string" ? p.badges : "")
    .split(",")
    .map((b) => b.trim().replace("{steps}", String(course.steps)))
    .filter(Boolean);
  const card = (
    <div className="he-course">
      <div className="he-course-intro">
        {p.cardTitle ? <h3>{p.cardTitle}</h3> : null}
        <p>{body}</p>
        {badges.length ? (
          <div className="he-course-badges">
            {badges.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        ) : null}
        <a className="he-btn he-primary" href={course.url}>
          {p.buttonLabel || "Open the course"}
        </a>
      </div>
      {p.showModules !== false && course.modules.length ? (
        <nav className="he-module-list" aria-label="Course modules">
          {course.modules.map((m, i) => (
            <a key={m.title || i} href={m.href}>
              <span className="he-m-roman">{roman(i)}</span>
              <span className="he-m-title">
                {m.title}
                <span className="he-m-sub">{m.summary}</span>
              </span>
              <span className="he-m-steps">
                {m.steps} {m.steps === 1 ? "step" : "steps"}
              </span>
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
  return (
    <section className="blk he-course-block">
      <header className="he-section-head">
        {p.eyebrow ? <p className="he-eyebrow">{p.eyebrow}</p> : null}
        <h2>{heading}</h2>
        {typeof p.intro === "string" && p.intro.trim() ? <p className="he-lede">{p.intro}</p> : null}
      </header>
      {drawn ? <div inert>{card}</div> : card}
    </section>
  );
}

export const heCourse = defineBlock(
  {
    id: "he-course",
    label: "Course card",
    category: "listings",
    description: "Ario's Sophia course, Enneagram Foundations: its modules and step count, read from the published course.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Course block", sel: "> .he-course-block" },
      eyebrow: { label: "Eyebrow", sel: "> .he-course-block .he-section-head .he-eyebrow", prop: "eyebrow" },
      heading: { label: "Heading", sel: "> .he-course-block .he-section-head h2", prop: "heading" },
      intro: { label: "Introduction", sel: "> .he-course-block .he-section-head .he-lede", prop: "intro" },
      card: { label: "Card", sel: ".he-course" },
      badges: { label: "Badges", sel: ".he-course-badges" },
      button: { label: "Button", sel: ".he-course-intro .he-btn", prop: "buttonLabel" },
      modules: { label: "Module list", sel: ".he-module-list" },
    },
    tokens: [
      { name: "--he-card", label: "Card ground", type: "color" },
      { name: "--he-aurum", label: "Gold", type: "color" },
    ],
  },
  HeCourse,
);
