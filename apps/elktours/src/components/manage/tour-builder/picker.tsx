"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@elkdonis/primitives";
import { PlaceSuggestions } from "@/components/places/place-suggestions";
import { LocationCreator, type CreatedLocation } from "@/components/places/location-creator";
import type { Experience, Place, PlaceSuggestion } from "@/lib/catalogue-types";
import { distanceM, formatDistance } from "@/components/places/types";

interface BuilderPickerProps {
  catalogue: Place[];
  experiences: Experience[];
  /** Place ids already used by a stop of this tour. */
  usedPlaceIds: Set<string>;
  usedExperienceIds: Set<string>;
  near: { lat: number; lng: number } | null;
  /** "after stop 3" etc. */
  insertLabel: string;
  onPickPlace: (p: Place) => void;
  onPickExperience: (e: Experience) => void;
  onPickSuggestion: (s: PlaceSuggestion) => Promise<void>;
  onBlank: () => void;
  /** A custom location (pin or photo) was added to the catalogue. */
  onCreatedLocation: (created: CreatedLocation) => void;
}

/** The right-hand picker: Catalogue · Experiences · Suggestions · New. */
export function BuilderPicker(props: BuilderPickerProps) {
  const { catalogue, experiences, usedPlaceIds, usedExperienceIds, near, insertLabel } = props;
  const [q, setQ] = useState("");
  const [eq, setEq] = useState("");

  const places = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalogue
      .filter((p) => !p.archivedAt)
      .filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.tags.some((t) => t.toLowerCase().includes(needle)) || (p.address ?? "").toLowerCase().includes(needle))
      .map((p) => ({ p, d: near && p.lat != null && p.lng != null ? distanceM(near, { lat: p.lat, lng: p.lng }) : null }))
      .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity) || a.p.title.localeCompare(b.p.title))
      .slice(0, 60);
  }, [catalogue, q, near]);

  const exps = useMemo(() => {
    const needle = eq.trim().toLowerCase();
    return experiences.filter((e) => !needle || e.title.toLowerCase().includes(needle) || e.people.some((p) => p.name.toLowerCase().includes(needle)));
  }, [experiences, eq]);

  return (
    <Tabs defaultValue="catalogue" className="border border-border bg-card p-3">
      <TabsList variant="line" className="w-full">
        <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
        <TabsTrigger value="experiences">Experiences</TabsTrigger>
        <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        <TabsTrigger value="new">New</TabsTrigger>
      </TabsList>
      <p className="mt-2 text-xs text-muted-foreground">Adds {insertLabel}. The stop gets its own copy of the text and pose.</p>

      <TabsContent value="catalogue" className="mt-3 space-y-2">
          <>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the catalogue" />
            <ul className="max-h-[28rem] divide-y divide-border overflow-auto border border-border">
              {places.length === 0 && <li className="p-3 text-sm text-muted-foreground">No places match.</li>}
              {places.map(({ p, d }) => (
                <li key={p.id} className="flex items-center gap-2 px-2 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[formatDistance(d), p.tags.slice(0, 2).join(", ")].filter(Boolean).join(" · ") || " "}
                    </span>
                  </span>
                  {usedPlaceIds.has(p.id) && <Badge variant="outline">in tour</Badge>}
                  <Button type="button" size="icon-xs" variant="outline" onClick={() => props.onPickPlace(p)} aria-label={`Add ${p.title}`}>
                    <Plus className="size-3" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </>
      </TabsContent>

      <TabsContent value="experiences" className="mt-3 space-y-2">
        {experiences.length === 0 ? (
          <p className="text-sm text-muted-foreground">No experiences yet.</p>
        ) : (
          <>
            <Input value={eq} onChange={(e) => setEq(e.target.value)} placeholder="Search experiences or artists" />
            <ul className="max-h-[28rem] divide-y divide-border overflow-auto border border-border">
              {exps.map((e) => (
                <li key={e.id} className="flex items-center gap-2 px-2 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[e.format.replace("_", " "), e.people.map((p) => p.name).join(", "), e.location].filter(Boolean).join(" · ") || " "}
                    </span>
                  </span>
                  {e.status !== "published" && <Badge variant="outline">{e.status}</Badge>}
                  {usedExperienceIds.has(e.id) && <Badge variant="outline">in tour</Badge>}
                  <Button type="button" size="icon-xs" variant="outline" onClick={() => props.onPickExperience(e)} aria-label={`Add ${e.title}`}>
                    <Plus className="size-3" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </TabsContent>

      <TabsContent value="suggestions" className="mt-3">
        <PlaceSuggestions catalogue={catalogue} near={near} onPick={props.onPickSuggestion} />
      </TabsContent>

      <TabsContent value="new" className="mt-3 space-y-2">
        <p className="text-sm text-muted-foreground">
          A place of your own: drop a pin, or upload a photo taken there. It joins the catalogue and becomes a stop.
        </p>
        <LocationCreator compact center={near} onCreated={props.onCreatedLocation} />
        <div className="border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            Or a blank stop, not linked to the catalogue. Fill it in on the left; search its position there.
          </p>
          <Button type="button" variant="outline" className="mt-2" onClick={props.onBlank}>
            <Plus className="size-4" aria-hidden /> Blank stop
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
