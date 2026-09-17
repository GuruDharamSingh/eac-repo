import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { SuggestForm } from "@/components/suggest-form";

export const metadata: Metadata = { title: "Suggest a book" };

export default async function SuggestPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; kind?: string }>;
}) {
  const { title, kind } = await searchParams;
  const hosting = kind === "host";
  const viewer = await getViewer();
  return (
    <div className="column band">
      <p className="eyebrow">Take part</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>{hosting ? "Host a reading session" : "Suggest a book"}</h1>
      <p className="prose" style={{ margin: "10px 0 22px", color: "var(--ink-muted)" }}>
        {hosting
          ? "A session needs a room, a reader, and someone to keep the time. Tell the circle what you can offer and we\u2019ll be in touch."
          : "What should the circle read next? It doesn\u2019t have to be a Fourth Way book \u2014 it has to be one that rewards being read aloud, slowly, with others."}
      </p>
      <SuggestForm initialTitle={(title ?? "").slice(0, 200)} signedIn={Boolean(viewer)} mode={hosting ? "host" : "book"} />
    </div>
  );
}
