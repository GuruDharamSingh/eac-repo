import type { Metadata } from "next";
import { BookOpen, Download, Music } from "lucide-react";
import { getSiteSections } from "@/lib/data";

export const metadata: Metadata = {
  title: "Sadhana Resources",
  description: "Sacred texts and songs to support your practice.",
};

/**
 * Texts and songs for the practice. Card copy is the site's own, recovered
 * from the pre-rebuild /sadhana and /resources pages.
 */
const RESOURCES = [
  {
    Icon: BookOpen,
    title: "Jap Ji Sahib",
    kicker: "The Cosmic Meditation",
    description:
      "The foundational morning prayer of Sikh Dharma, containing the essence of all spiritual teachings. Recited at the opening of every Amrit Vela practice, Jap Ji Sahib was composed by Guru Nanak and describes the nature of God and the path of the soul.",
    href: "/jap_jee_-_the_cosmic_meditation_-_2010.pdf",
    action: "Download PDF",
    note: null,
    accent: "#e6b422",
  },
  {
    Icon: Music,
    title: "Aquarian Sadhana Kirtan",
    kicker: "Sacred Mantras & Chants",
    description:
      "The sacred mantras and devotional songs used in our 2.5-hour practice. These healing sounds elevate consciousness and create spiritual connection. The Aquarian Sadhana sequence includes seven chants that take you through different dimensions of awareness.",
    href: null,
    action: null,
    note: "Lyrics shared at gatherings — recordings coming soon.",
    accent: "#e67e50",
  },
];

/**
 * The actual sequence and timings as practised here, from the original
 * sadhana page. Do not paraphrase these — the durations are the practice.
 */
const AQUARIAN_SEQUENCE = [
  "Japji Sahib – 20 min",
  "Kundalini Yoga Kriya – 30 min",
  "Savasana – 5 min",
  "Long Chant (Ong Namo) – 7 min",
  "Seven Aquarian Sadhana Chants – 62 min",
  "Long Time Sun – 3 min",
];

export default async function ResourcesPage() {
  const sections = await getSiteSections();
  const copy = sections.resources;

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <h1 className="text-center font-serif text-4xl">
        {copy?.title ?? "Sadhana Resources"}
      </h1>
      <p className="mt-3 text-center italic text-muted-foreground">
        {copy?.body ?? "Sacred texts and songs to support your practice"}
      </p>
      <hr className="saffron-divider mx-auto max-w-xs" />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {RESOURCES.map(({ Icon, title, kicker, description, href, action, note, accent }) => (
          <div key={title} className="card-natural flex flex-col p-7">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(244,196,48,0.2)", color: accent }}
              >
                <Icon className="size-6" />
              </span>
              <div>
                <h2 className="font-serif text-xl font-bold">{title}</h2>
                <p className="text-xs italic text-muted-foreground">{kicker}</p>
              </div>
            </div>

            <hr className="my-4 border-[#f4c430]/30" />

            <p className="text-sm leading-relaxed">{description}</p>

            <div className="mt-auto pt-5">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-[#e6b422] px-4 py-2 text-sm font-medium transition hover:bg-[#f4c430]/15"
                >
                  <Download className="size-4" aria-hidden />
                  {action}
                </a>
              ) : (
                <p className="text-center text-xs italic text-muted-foreground">{note}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="card-natural mt-12 p-8">
        <h2 className="font-serif text-2xl">The Aquarian Sadhana Sequence</h2>
        <p className="mt-2 text-muted-foreground">
          The complete Aquarian Sadhana is a 2.5-hour morning practice:
        </p>
        <ol className="mt-5 space-y-2">
          {AQUARIAN_SEQUENCE.map((step, i) => (
            <li key={step} className="flex items-baseline gap-3">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f4c430]/25 text-xs font-semibold"
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
