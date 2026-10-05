import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@elkdonis/db";
import { requireStudioReviewer } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Readings" };
export const dynamic = "force-dynamic";

// The shapes the Jerusalem app syncs (app_records kinds "reading" and "mark"; ~/jerusalem/src/readings.ts, marks.ts).
interface Attachment {
  type: "audio" | "image" | "video";
  remote?: string;
  createdAt: string;
}
interface Reading {
  id: string;
  name: string;
  status: "open" | "done";
  chart: { birth: { date: string; time: string; placeName: string } };
  text: string;
  attachments: Attachment[];
  factors: { id: string; label: string; note: string }[];
  refs: { textId: string; factorLabel?: string; excerpt: string; book: string; note?: string; addedAt: string }[];
  takes: { clipId: string; title: string; durationMs?: number; remote?: string; at: number }[];
  updatedAt: string;
}
interface Mark {
  id: string;
  kind: "personal" | "reading" | "post";
  title: string;
  at: number;
  eventTitle?: string;
  readingId?: string;
  note?: string;
}

const KIND: Record<Mark["kind"], string> = { personal: "★ Personal", reading: "◐ Reading", post: "▶ Post" };
const media = (path: string) => withBase(`/api/mobile/v1/media?path=${encodeURIComponent(path)}`);
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const mmss = (ms = 0) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;

/**
 * Readings and bookmarks from the Jerusalem phone app, for the org's owners
 * (both of them see both). Each reading: the person's chart details, the
 * placements picked out with notes, the passages kept, takes, images and
 * voice notes, and the moments starred for it. Files stream from the org's
 * private Nextcloud folder through /api/mobile/v1/media.
 */
export default async function HubReadingsPage() {
  const viewer = await requireStudioReviewer("/hub/readings");
  const rows = await db<{ user_id: string; kind: string; data: unknown }[]>`
    SELECT r.user_id, r.kind, r.data FROM app_records r
    WHERE r.app = 'jerusalem' AND r.kind IN ('reading', 'mark') AND r.deleted_at IS NULL
      AND r.user_id IN (SELECT user_id FROM user_organizations WHERE org_id = ${siteConfig.orgId} AND role = 'owner')
    ORDER BY r.updated_at DESC
  `;
  const readings = rows.filter((r) => r.kind === "reading").map((r) => ({ ...(r.data as Reading), mine: r.user_id === viewer.userId }));
  const marks = rows.filter((r) => r.kind === "mark").map((r) => r.data as Mark).sort((a, b) => a.at - b.at);
  const now = Date.now();
  const bookmarks = marks.filter((m) => m.kind !== "reading");
  const coming = bookmarks.filter((m) => m.at >= now);
  const past = bookmarks.filter((m) => m.at < now).reverse();

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/hub" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
        ← Hub
      </Link>
      <h1 className="mt-4 text-3xl font-semibold md:text-4xl">Readings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Gathered on the phone (Jerusalem › Readings) and synced here. Owners only.
      </p>

      {readings.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-display text-2xl">No readings yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Start one in the app's Readings tab; it appears here after a sync.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {readings.map((r) => {
            const moments = marks.filter((m) => m.readingId === r.id);
            const images = r.attachments.filter((a) => a.remote && a.type === "image");
            const sounds = r.attachments.filter((a) => a.remote && a.type === "audio");
            return (
              <details key={r.id} className="group rounded-2xl border border-border bg-card shadow-sm" open={readings.length === 1}>
                <summary className="cursor-pointer list-none px-5 py-4">
                  <span className="flex items-center justify-between gap-4">
                    <span className="font-display text-xl">{r.name}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {r.status}
                      {r.mine ? "" : " · other owner"}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {r.chart.birth.date} {r.chart.birth.time} · {r.chart.birth.placeName} · {r.factors.length} placements · {r.refs.length} passages · {r.takes.length} takes
                  </span>
                </summary>
                <div className="space-y-6 border-t border-border px-5 py-5">
                  {r.text && <p className="whitespace-pre-wrap text-sm">{r.text}</p>}

                  {r.factors.length > 0 && (
                    <section>
                      <h2 className="text-xs uppercase tracking-[0.2em] text-gold">Placements and aspects</h2>
                      <ul className="mt-2 space-y-2">
                        {r.factors.map((f) => (
                          <li key={f.id}>
                            <p className="font-medium">{f.label}</p>
                            {f.note && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{f.note}</p>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {r.refs.length > 0 && (
                    <section>
                      <h2 className="text-xs uppercase tracking-[0.2em] text-gold">Passages kept</h2>
                      <ul className="mt-2 space-y-3">
                        {r.refs.map((x, i) => (
                          <li key={`${x.textId}-${i}`} className="rounded-xl border border-border p-3">
                            <p className="text-xs text-muted-foreground">
                              {x.book}
                              {x.factorLabel ? ` · ${x.factorLabel}` : ""}
                            </p>
                            <blockquote className="mt-1 text-sm">{x.excerpt}</blockquote>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {r.takes.length > 0 && (
                    <section>
                      <h2 className="text-xs uppercase tracking-[0.2em] text-gold">Takes</h2>
                      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                        {r.takes.map((t) => (
                          <li key={t.clipId}>
                            <p className="text-sm">
                              {t.title} <span className="text-muted-foreground">· {mmss(t.durationMs)}</span>
                            </p>
                            {t.remote ? (
                              <video controls preload="none" className="mt-1 max-h-96 w-full rounded-lg bg-black" src={media(t.remote)} />
                            ) : (
                              <p className="text-xs text-muted-foreground">Not uploaded yet (it goes up on the phone's next sync).</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {(images.length > 0 || sounds.length > 0) && (
                    <section>
                      <h2 className="text-xs uppercase tracking-[0.2em] text-gold">Images and voice notes</h2>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {images.map((a) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a key={a.remote} href={media(a.remote!)} target="_blank" rel="noreferrer">
                            <img src={media(a.remote!)} alt="" className="h-32 w-32 rounded-lg object-cover" />
                          </a>
                        ))}
                      </div>
                      {sounds.map((a) => (
                        <audio key={a.remote} controls preload="none" className="mt-2 w-full" src={media(a.remote!)} />
                      ))}
                    </section>
                  )}

                  {moments.length > 0 && (
                    <section>
                      <h2 className="text-xs uppercase tracking-[0.2em] text-gold">Moments</h2>
                      <ul className="mt-2 space-y-1 text-sm">
                        {moments.map((m) => (
                          <li key={m.id}>
                            {when(m.at)} · {m.title}
                            {m.note ? <span className="text-muted-foreground"> — {m.note}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <h2 className="mt-12 text-2xl font-semibold">Bookmarks</h2>
      <p className="mt-1 text-sm text-muted-foreground">Starred events and bookmarked dates (personal and for posts). Times are Toronto time.</p>
      {bookmarks.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">None yet.</p>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {[
            { title: "Coming up", list: coming },
            { title: "Past", list: past },
          ].map((g) => (
            <section key={g.title}>
              <h3 className="text-xs uppercase tracking-[0.2em] text-gold">{g.title}</h3>
              <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                {g.list.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Nothing.</li>}
                {g.list.map((m) => (
                  <li key={m.id} className="px-4 py-3">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {KIND[m.kind]} · {when(m.at)}
                      {m.eventTitle && m.eventTitle !== m.title ? ` · ${m.eventTitle}` : ""}
                    </p>
                    {m.note && <p className="mt-1 text-sm">{m.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
