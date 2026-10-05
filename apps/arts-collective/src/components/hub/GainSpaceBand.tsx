import Link from "next/link";
import { hasGainedSpace } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * "Gain your space", above every hub tab, for a signed-in person who is not
 * yet an artist of the collective (no member+ row in `oad`). The link opens
 * the artist onboarding, and opening it is what gains the space (gainSpace in
 * /wizard). Signed-out visitors and artists see nothing.
 */
export async function GainSpaceBand() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (await hasGainedSpace(user.id).catch(() => true)) return null;

  return (
    <section
      aria-label="Gain your space"
      className="mt-5 flex flex-col gap-3 rounded-md border border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-serif text-lg leading-tight">Gain your space in the collective</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A listing on ArtDirect and file storage of your own. No organisation
          needed; you can start one later.
        </p>
      </div>
      <Link
        href="/wizard"
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Gain your space
      </Link>
    </section>
  );
}
