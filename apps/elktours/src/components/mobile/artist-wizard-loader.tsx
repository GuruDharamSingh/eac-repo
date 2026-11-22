import { ArtistWizardView, type WizardInitial } from "@/components/mobile/artist-wizard-view";
import { canUseArtistWizard, getAvailability, getMyArtistProfile, getMyExperience, listMyExperiences } from "@/lib/artist-wizard";
import { listPlaces } from "@/lib/places";
import { getViewer } from "@/lib/auth";

/** Server loader for the wizard on /artist/experiences/new and /[id] (G7c). */
export async function ArtistWizardLoader({ id }: { id?: string }) {
  const gate = await canUseArtistWizard();
  if (gate.ok === false) return <p className="m-flow-empty">{gate.error}</p>;
  const [viewer, me, mine, places, availability, draft] = await Promise.all([
    getViewer(), getMyArtistProfile(), listMyExperiences(), listPlaces({ limit: 200 }), getAvailability(), id ? getMyExperience(id) : Promise.resolve(null),
  ]);
  const initial: WizardInitial = {
    id: draft?.id ?? null, title: draft?.title ?? "", pitch: draft?.pitch ?? "",
    format: (draft?.format as WizardInitial["format"]) ?? "in_person", placeId: draft?.placeId ?? null,
    durationMinutes: draft?.durationMinutes ?? null, groupSize: draft?.groupSize ?? null, offer: draft?.offer ?? null, notes: draft?.notes ?? null,
  };
  return (
    <ArtistWizardView
      home="/artist"
      isNew={mine.length === 0 && !draft}
      viewer={{ name: me?.name ?? "", email: me?.email ?? viewer?.email ?? "", craft: me?.craft ?? "", area: me?.area ?? "", about: me?.about ?? "" }}
      places={places.map((p) => ({ id: p.id, title: p.title }))}
      availability={availability}
      initial={initial}
    />
  );
}
