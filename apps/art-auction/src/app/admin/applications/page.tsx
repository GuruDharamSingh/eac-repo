import type { Metadata } from "next";
import { listPendingArtistApplications } from "@elkdonis/commerce/queries";
import { requireAdmin } from "@/lib/marketplace-auth";
import { sanitizeRichText } from "@elkdonis/utils";
import { ApplicationActions } from "./application-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artist applications · Admin" };

export default async function ApplicationsPage() {
  await requireAdmin();
  const applications = await listPendingArtistApplications();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">
          Artist applications
        </h1>
        <p className="mt-2 text-muted-foreground">
          {applications.length} pending review.
        </p>
      </header>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          No pending applications.
        </div>
      ) : (
        <ul className="space-y-6">
          {applications.map((a) => (
            <li
              key={a.userId}
              className="rounded-lg border border-border p-6"
            >
              <div className="flex items-start gap-4">
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                  {a.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.photoUrl}
                      alt={a.displayName ?? "Artist"}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-xl">
                    {a.displayName ?? "Unnamed artist"}
                  </p>
                  {a.headline && (
                    <p className="text-sm text-muted-foreground">{a.headline}</p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.city ? `${a.city} · ` : ""}
                    {a.payoutEmail}
                  </p>
                  {a.bioHtml && (
                    <div
                      className="prose prose-sm mt-3 max-w-none text-foreground"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichText(a.bioHtml),
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <ApplicationActions artistUserId={a.userId} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
