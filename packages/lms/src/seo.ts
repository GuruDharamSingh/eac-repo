// ============================================================================
// Structured data. Pure functions: a course in, schema.org JSON-LD out.
// Public content only — nothing about any person or any run's inner life.
// ============================================================================
import type { PublishedCourse, PublishedStep, Run } from './types';
import { stepTypeDef } from './step-types';

export interface SeoContext {
  /** Canonical origin, no trailing slash: https://sophia.arts-collective.com */
  origin: string;
  /** Absolute URL for a media path stored relative to another app. */
  mediaUrl?: (url: string) => string;
}
const abs = (ctx: SeoContext, path: string) => `${ctx.origin}${path}`;
export const courseUrl = (ctx: SeoContext, pc: PublishedCourse) => abs(ctx, `/${pc.course.slug}`);
export const stepUrl = (ctx: SeoContext, pc: PublishedCourse, s: PublishedStep) => abs(ctx, `/${pc.course.slug}/${s.slug}`);

const COURSE_MODE: Record<string, string[]> = {
  open: ['Online', 'Asynchronous'], drip: ['Online', 'Asynchronous'],
  cohort: ['Online', 'Synchronous'], circle: ['Online', 'Synchronous'],
};

export function courseJsonLd(ctx: SeoContext, pc: PublishedCourse, runs: Run[]): object {
  const minutes = pc.steps.reduce((n, s) => n + (Number(s.settings.minutes) || 0), 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': courseUrl(ctx, pc),
    url: courseUrl(ctx, pc),
    name: pc.course.title,
    description: pc.course.summary ?? undefined,
    inLanguage: pc.course.language,
    isAccessibleForFree: true,
    dateModified: pc.publishedAt.toISOString(),
    image: pc.course.coverUrl ? (ctx.mediaUrl?.(pc.course.coverUrl) ?? pc.course.coverUrl) : undefined,
    provider: { '@type': 'Organization', name: pc.course.orgName },
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'CAD', category: 'Free' },
    timeRequired: minutes ? `PT${minutes}M` : undefined,
    syllabusSections: pc.modules.map((m) => ({ '@type': 'Syllabus', name: m.title, description: m.summary ?? undefined })),
    hasPart: pc.steps.map((s) => ({ '@type': 'LearningResource', name: s.title, url: stepUrl(ctx, pc, s), learningResourceType: stepTypeDef(s.type).label })),
    hasCourseInstance: runs.filter((r) => r.status === 'open').map((r) => ({
      '@type': 'CourseInstance', name: r.title, courseMode: COURSE_MODE[r.mode] ?? ['Online'],
      startDate: r.startsAt?.toISOString(), endDate: r.endsAt?.toISOString(),
      courseWorkload: minutes ? `PT${minutes}M` : undefined,
    })),
  };
}

export function stepJsonLd(ctx: SeoContext, pc: PublishedCourse, s: PublishedStep): object[] {
  const out: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      '@id': stepUrl(ctx, pc, s),
      url: stepUrl(ctx, pc, s),
      name: s.title,
      description: s.summary ?? undefined,
      inLanguage: pc.course.language,
      isAccessibleForFree: true,
      learningResourceType: stepTypeDef(s.type).label,
      timeRequired: s.settings.minutes ? `PT${s.settings.minutes}M` : undefined,
      position: s.index + 1,
      isPartOf: { '@type': 'Course', '@id': courseUrl(ctx, pc), name: pc.course.title },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: pc.course.title, item: courseUrl(ctx, pc) },
        { '@type': 'ListItem', position: 2, name: s.moduleTitle, item: `${courseUrl(ctx, pc)}#${s.moduleId}` },
        { '@type': 'ListItem', position: 3, name: s.title, item: stepUrl(ctx, pc, s) },
      ],
    },
  ];
  for (const m of s.refs.media ?? []) {
    if (m.kind !== 'audio' && m.kind !== 'video') continue;
    out.push({
      '@context': 'https://schema.org',
      '@type': m.kind === 'audio' ? 'AudioObject' : 'VideoObject',
      name: m.title ?? s.title,
      description: s.summary ?? s.title,
      contentUrl: ctx.mediaUrl?.(m.url) ?? m.url,
      uploadDate: pc.publishedAt.toISOString(),
      duration: m.durationSeconds ? `PT${Math.round(m.durationSeconds)}S` : undefined,
      transcript: m.transcript ?? undefined,
    });
  }
  return out;
}

/** Published, listed courses and their steps. Drafts, private and unlisted never appear. */
export function sitemapEntries(ctx: SeoContext, courses: PublishedCourse[]): Array<{ url: string; lastModified: Date }> {
  return courses
    .filter((pc) => pc.course.visibility === 'public')
    .flatMap((pc) => [
      { url: courseUrl(ctx, pc), lastModified: pc.publishedAt },
      ...pc.steps.map((s) => ({ url: stepUrl(ctx, pc, s), lastModified: pc.publishedAt })),
    ]);
}
