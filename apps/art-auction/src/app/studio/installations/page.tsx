import Link from "next/link";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { listInstallationsForStores } from "@/lib/installations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createInstallationAction } from "./actions";
import { INSTALLATION_VENUES } from "@/lib/installation-venues";

export const dynamic = "force-dynamic";

export default async function InstallationsPage() {
  const { store } = await requireStudioStore();
  const installations = await listInstallationsForStores([store.id]);

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-2xl tracking-tight">Install a collection</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Hang a body of work in the long hallway: drag each piece onto the
          wall where it belongs and choose its frame. The order a visitor
          meets them walking the hall becomes the collection&apos;s order.
        </p>
        <form action={createInstallationAction} className="mt-5 flex flex-wrap gap-3">
          <fieldset className="flex w-full flex-wrap gap-3">
            <legend className="mb-2 text-sm font-medium">Where to hang it</legend>
            {INSTALLATION_VENUES.map((v, i) => (
              <label
                key={v.id}
                className="flex min-w-[240px] flex-1 cursor-pointer items-start gap-2 rounded-md border border-border p-3 text-sm has-[:checked]:border-foreground has-[:checked]:bg-muted"
              >
                <input type="radio" name="venue" value={v.id} defaultChecked={i === 0} className="mt-1" />
                <span>
                  <span className="font-medium">{v.name}</span>
                  <span className="block text-xs text-muted-foreground">{v.blurb}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <input
            name="title"
            required
            maxLength={140}
            placeholder="Name the collection, e.g. Harvest paintings 2026"
            className="h-10 min-w-[280px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button type="submit">Start hanging</Button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-2xl tracking-tight">
          Your installations
          <span className="ml-2 text-base text-muted-foreground">({installations.length})</span>
        </h2>
        {installations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing hung yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {installations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/studio/installations/${i.id}`} className="font-medium hover:underline">
                    {i.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i.pieceCount} {i.pieceCount === 1 ? "piece" : "pieces"} hung · updated{" "}
                    {new Date(i.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={i.status === "published" ? "success" : "neutral"}>
                    {i.status === "published" ? "Open to visitors" : "Draft"}
                  </Badge>
                  {i.status === "published" && (
                    <Link href={`/installations/${i.id}`} className="text-sm underline underline-offset-4">
                      Walk it
                    </Link>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/studio/installations/${i.id}`}>Edit the hang</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
