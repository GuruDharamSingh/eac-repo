import Link from "next/link";
import { ExperienceForm } from "@/components/manage/experience-form";
import { ArtistWizardView, type WizardInitial } from "@/components/mobile/artist-wizard-view";
import { Split } from "@/components/mobile/split";
import { canUseArtistWizard, getAvailability, getMyExperience, listMyExperiences } from "@/lib/artist-wizard";
import { listPersonOptions } from "@/lib/experiences";
import { listPlaces } from "@/lib/places";
import { getViewer, requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewExperiencePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await searchParams;
  const personOptions = await listPersonOptions().catch(() => []);

  // Phone tree: the four-step artist wizard (screen 35). Desktop keeps ExperienceForm below, unchanged.
  const gate = await canUseArtistWizard();
  let mobile: React.ReactNode;
  if (gate.ok === false) {
    mobile = <p className="m-flow-empty">{gate.error}</p>;
  } else {
    const [viewer, mine, places, availability, draft] = await Promise.all([
      getViewer(),
      listMyExperiences(),
      listPlaces({ limit: 200 }),
      getAvailability(),
      id ? getMyExperience(id) : Promise.resolve(null),
    ]);
    const initial: WizardInitial = {
      id: draft?.id ?? null,
      title: draft?.title ?? "",
      pitch: draft?.pitch ?? "",
      format: (draft?.format as WizardInitial["format"]) ?? "in_person",
      placeId: draft?.placeId ?? null,
      durationMinutes: draft?.durationMinutes ?? null,
      groupSize: draft?.groupSize ?? null,
      offer: draft?.offer ?? null,
      notes: draft?.notes ?? null,
    };
    mobile = (
      <ArtistWizardView
        isNew={mine.length === 0 && !draft}
        viewer={{ name: "", email: viewer?.email ?? "" }}
        places={places.map((p) => ({ id: p.id, title: p.title }))}
        availability={availability}
        initial={initial}
      />
    );
  }

  return (
    <Split
      mobile={mobile}
      desktop={
        <>
          <Link href="/manage/experiences" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Experiences</Link>
          <h2 className="mt-1 font-serif text-2xl">New experience</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only the title is needed to start; pictures are added after the first save.</p>
          <div className="mt-6">
            <ExperienceForm personOptions={personOptions} />
          </div>
        </>
      }
    />
  );
}
