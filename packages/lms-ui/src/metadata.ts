import { getPublishedCourse } from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";

/** Shape-compatible with Next's Metadata; typed loosely so the package needn't import it. */
export interface LmsMetadata {
  title?: string;
  description?: string;
  alternates?: { canonical: string };
  robots?: { index: boolean; follow: boolean };
  openGraph?: { title: string; description?: string; url: string; type: "website" | "article"; siteName: string; images?: string[] };
}

export async function courseMetadata(c: LmsConnectors, courseSlug: string): Promise<LmsMetadata> {
  const pc = await getPublishedCourse(courseSlug);
  if (!pc || pc.course.visibility === "private") return { robots: { index: false, follow: false } };
  const url = `${c.origin}${c.hrefs.course(pc.course.slug)}`;
  return {
    title: pc.course.title,
    description: pc.course.summary ?? undefined,
    alternates: { canonical: url },
    robots: { index: pc.course.visibility === "public", follow: true },
    openGraph: { title: pc.course.title, description: pc.course.summary ?? undefined, url, type: "website", siteName: c.site.name, images: pc.course.coverUrl ? [c.mediaUrl(pc.course.coverUrl)] : undefined },
  };
}

export async function stepMetadata(c: LmsConnectors, courseSlug: string, stepSlug: string): Promise<LmsMetadata> {
  const pc = await getPublishedCourse(courseSlug);
  const step = pc?.steps.find((s) => s.slug === stepSlug);
  if (!pc || !step || pc.course.visibility === "private") return { robots: { index: false, follow: false } };
  const url = `${c.origin}${c.hrefs.step(pc.course.slug, step.slug)}`;
  // A dated step says "opens on…" until its day; don't index the closed door.
  const dated = step.unlock.kind === "date" && new Date(step.unlock.at) > new Date();
  return {
    title: `${step.title} · ${pc.course.title}`,
    description: step.summary ?? undefined,
    alternates: { canonical: url },
    robots: { index: pc.course.visibility === "public" && !dated && step.unlock.kind !== "offset_days", follow: true },
    openGraph: { title: step.title, description: step.summary ?? undefined, url, type: "article", siteName: c.site.name, images: pc.course.coverUrl ? [c.mediaUrl(pc.course.coverUrl)] : undefined },
  };
}
