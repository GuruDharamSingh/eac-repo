import { courseUrl } from "@/config/site";

// ============================================================================
// Ario's Sophia course, as the course card draws it. Client-safe: plain data.
// The server resolver reads the published version from the lms tables
// (lib/course.ts); this static copy (the ÆON draft's module list, checked
// against published v1 on 2026-11-07) is what the card shows when that read
// fails, and what the editor canvas shows.
// ============================================================================

export interface CourseModule {
  title: string;
  summary: string;
  steps: number;
  href: string;
}

export interface CourseSummary {
  title: string;
  summary: string;
  steps: number;
  url: string;
  modules: CourseModule[];
  /** True when read from the lms tables; false = this static copy. */
  live: boolean;
}

export const STATIC_COURSE: CourseSummary = {
  title: "Enneagram Foundations",
  summary:
    "A free walk through the Hidden Enneagram: the three centers, the core fixation and its hidden triads, wings, the nine types, and the instincts — in short steps with private reflections.",
  steps: 27,
  url: courseUrl(),
  live: false,
  modules: [
    { title: "Orientation", summary: "What the enneagram maps, and where your story begins", steps: 3, href: courseUrl("welcome") },
    { title: "The Three Centers", summary: "Gut, Heart and Head — and the one working overtime", steps: 3, href: courseUrl("centers-of-energy") },
    { title: "The Core Fixation", summary: "The looped response pattern and the hidden triads", steps: 3, href: courseUrl("the-looped-pattern") },
    { title: "Wings and Movement", summary: "The figure in motion: wings, stress and growth", steps: 2, href: courseUrl("wings") },
    { title: "The Nine Points", summary: "One reading per fixation — start with the point that stings", steps: 10, href: courseUrl("type-1") },
    { title: "The Instincts", summary: "Self-preservation, sexual, social — and the blind spot", steps: 3, href: courseUrl("three-instincts") },
    { title: "Going Further", summary: "The figure, a typing session, and what comes next", steps: 3, href: courseUrl("the-figure") },
  ],
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const roman = (i: number) => ROMAN[i] ?? String(i + 1);
