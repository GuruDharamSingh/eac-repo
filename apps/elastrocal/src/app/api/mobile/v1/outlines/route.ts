import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

/**
 * Outline review (Jerusalem app, Studio › Outline), owners only (migration 196).
 *
 * GET               → every book: its outline status, priority, passages, and
 *                     whether its outline holds a run of all twelve signs. The
 *                     books with a sign run and a high priority come first.
 * GET ?slug=<slug>  → one book: its card (shape, type, where its basic
 *                     material is) and its outline: the owner's reviewed
 *                     version if there is one, else the AI's first look.
 * PUT { slug, sections, shape?, status: "draft" | "confirmed" }
 *                   → save the reviewed outline. Sections must cover passage
 *                     ranges in order without overlap. Logged as an
 *                     astro_reviews 'outline-review' row.
 */

const ROLES = ["description", "introduction", "examples", "logic", "combinations", "reference", "front_back", "other"] as const;
const SIGNS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];

/** The AI's kind, as the nearest role in the owner's words. */
function roleOf(sec: Section): string {
  const s = { kind: sec.kind, layout: sec.layout, subject_type: subjectTypeOf(sec) };
  if (s.kind === "front_back") return "front_back";
  if (s.kind === "example") return "examples";
  if (s.kind === "technique") return "logic";
  if (s.layout && /keyword|fact_sheet|table|lexicon|name_list/.test(s.layout)) return "reference";
  if (s.subject_type && /_in_|aspect_planet|sign_pair/.test(s.subject_type)) return "combinations";
  if (s.subject_type && ["sign", "planet", "house", "ascendant_sign", "node", "angle"].includes(s.subject_type)) return "description";
  if (s.subject_type && ["element", "mode", "polarity", "aspect", "rulership", "decan"].includes(s.subject_type)) return "introduction";
  if (s.kind === "general") return "introduction";
  return "other";
}

type Section = { from: number; to: number; title?: string; chapter?: string; kind?: string; subject_type?: string; subjectType?: string; subjects?: string[]; layout?: string; note?: string; role?: string; voice?: string; passages?: number };
const subjectTypeOf = (s: Section) => s.subjectType ?? s.subject_type ?? "none";

export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug) {
    const rows = await db<{ slug: string; book: string; source_id: string | null; sections: Section[]; card: Record<string, unknown> | null; review_status: string | null; reviewed_at: Date | null; matched: number }[]>`
      SELECT o.slug, o.book, o.source_id, o.sections, o.review_status, o.reviewed_at,
             COALESCE(o.card, (SELECT c.card FROM astro_book_outlines c WHERE c.org_id = o.org_id AND c.source_id = o.source_id AND c.card IS NOT NULL LIMIT 1)) AS card,
             COALESCE((o.stats->>'matched')::int, 0) AS matched
      FROM astro_book_outlines o WHERE o.org_id = 'elastrocal'
    `;
    const books = rows.map((r) => {
      const signs = new Set(
        (r.sections ?? [])
          .filter((s) => subjectTypeOf(s) === "sign" && (s.kind === "general" || s.kind === "natal"))
          .flatMap((s) => (s.subjects ?? []).flatMap((x) => SIGNS.filter((g) => x.toLowerCase().includes(g)))),
      );
      const card = r.card ?? {};
      return {
        slug: r.slug,
        book: r.book,
        sourceId: r.source_id,
        sections: (r.sections ?? []).length,
        passages: r.matched || Number(card.passages ?? 0) || null,
        matched: r.matched,
        priority: (card.priority as string) ?? null,
        type: (card.type as string) ?? null,
        signRun: signs.size,
        status: r.review_status ?? "ai",
        reviewedAt: r.reviewed_at?.toISOString() ?? null,
      };
    });
    // Outlines whose passages never matched the library (an old copy of a book) go last.
    const rank = (b: (typeof books)[number]) => (b.matched ? 0 : 10) + (b.signRun >= 12 ? 0 : 2) + (b.priority === "high" ? 0 : b.priority === "medium" ? 0.5 : 1);
    books.sort((a, b) => rank(a) - rank(b) || a.book.localeCompare(b.book));
    return NextResponse.json({ books, roles: ROLES });
  }

  const [r] = await db<{ slug: string; book: string; source_id: string | null; sections: Section[]; card: Record<string, unknown> | null; reviewed_sections: Section[] | null; reviewed_shape: string | null; review_status: string | null }[]>`
    SELECT o.slug, o.book, o.source_id, o.sections, o.reviewed_sections, o.reviewed_shape, o.review_status,
           COALESCE(o.card, (SELECT c.card FROM astro_book_outlines c WHERE c.org_id = o.org_id AND c.source_id = o.source_id AND c.card IS NOT NULL LIMIT 1)) AS card
    FROM astro_book_outlines o WHERE o.org_id = 'elastrocal' AND o.slug = ${slug}
  `;
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ai = (r.sections ?? []).map((s) => ({ from: s.from, to: s.to ?? s.from, title: s.title ?? "", chapter: s.chapter ?? "", role: roleOf(s), subject_type: subjectTypeOf(s), subjects: s.subjects ?? [], note: s.note ?? "", aiKind: s.kind ?? null, layout: s.layout ?? null, passages: s.passages ?? null }));
  const card = r.card ?? {};
  return NextResponse.json({
    slug: r.slug,
    book: r.book,
    sourceId: r.source_id,
    status: r.review_status ?? "ai",
    shape: r.reviewed_shape ?? (card.shape as string) ?? "",
    aiShape: (card.shape as string) ?? "",
    card: { type: card.type ?? null, priority: card.priority ?? null, passages: card.passages ?? null, kinds: card.kinds ?? null, basicMaterial: card.basic_material ?? null },
    sections: r.reviewed_sections ?? ai,
    aiSections: ai,
    reviewed: !!r.reviewed_sections,
  });
}

export async function PUT(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const b = (await request.json().catch(() => null)) as { slug?: string; sections?: Section[]; shape?: string; status?: string } | null;
  if (!b?.slug || !Array.isArray(b.sections) || !b.sections.length) return NextResponse.json({ error: "slug and sections are required" }, { status: 400 });
  const status = b.status === "confirmed" ? "confirmed" : "draft";
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const sections = b.sections.map((s) => ({
    from: Number(s.from),
    to: Number(s.to),
    title: str(s.title, 300),
    chapter: str(s.chapter, 300),
    role: (ROLES as readonly string[]).includes(String(s.role)) ? String(s.role) : "other",
    subject_type: str(s.subject_type, 40) || "none",
    subjects: Array.isArray(s.subjects) ? s.subjects.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, 24) : [],
    ...(str(s.note, 2000) ? { note: str(s.note, 2000) } : {}),
    ...(typeof s.voice === "string" && s.voice.startsWith("Private/Jerusalem/") && !s.voice.includes("..") ? { voice: s.voice } : {}),
  }));
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (!Number.isInteger(s.from) || !Number.isInteger(s.to) || s.to < s.from) return NextResponse.json({ error: `Section ${i + 1} has a bad range` }, { status: 400 });
    if (i > 0 && s.from <= sections[i - 1].to) return NextResponse.json({ error: `Sections ${i} and ${i + 1} overlap` }, { status: 400 });
  }
  const shape = str(b.shape, 4000);
  const rows = await db`
    UPDATE astro_book_outlines
    SET reviewed_sections = ${db.json(sections as never)}, reviewed_shape = ${shape || null}, review_status = ${status}, reviewed_by = ${viewer.userId}, reviewed_at = now()
    WHERE org_id = 'elastrocal' AND slug = ${b.slug}
    RETURNING slug
  `;
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES ('elastrocal', NULL, ${viewer.userId}, 'outline-review', ${db.json({ slug: b.slug, status, sections: sections.length, shape: shape || null } as never)}, ${[]}, ${[]}, NULL, NULL, 'android')
  `;
  return NextResponse.json({ ok: true, status, sections: sections.length });
}
