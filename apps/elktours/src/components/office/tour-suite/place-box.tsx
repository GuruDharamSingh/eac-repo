"use client";

import * as React from "react";
import type { Place } from "@/lib/catalogue-types";
import { listAssetsAction } from "@/lib/asset-actions";
import { getPlaceSheet } from "@/lib/office-actions";
import { isPicture } from "./stop-pictures";

/** The place a stop stands on: name, address, how many pictures its own folder holds, and a link to edit it. */
export function PlaceBox({ placeId }: { placeId: string }) {
  const [place, setPlace] = React.useState<Place | null | undefined>(undefined);
  const [pictures, setPictures] = React.useState<number | null>(null);

  React.useEffect(() => {
    let live = true;
    setPlace(undefined);
    setPictures(null);
    getPlaceSheet(placeId)
      .then((s) => live && setPlace(s?.place ?? null))
      .catch(() => live && setPlace(null));
    listAssetsAction({ placeId })
      .then((l) => live && setPictures(l.filter(isPicture).length))
      .catch(() => live && setPictures(null));
    return () => {
      live = false;
    };
  }, [placeId]);

  if (place === undefined) return <p className="text-sm text-muted-foreground">Loading the place…</p>;
  if (!place) return <p className="text-sm text-muted-foreground">The place could not be opened.</p>;
  return (
    <div className="space-y-1 rounded-md border border-border p-3 text-sm">
      <p className="font-medium">{place.title}</p>
      {place.address && <p className="text-xs text-muted-foreground">{place.address}</p>}
      {pictures != null && <p className="text-xs text-muted-foreground">{pictures} {pictures === 1 ? "picture" : "pictures"} in its folder</p>}
      <p className="pt-1">
        <a href={`/manage/places/${place.id}`} className="text-xs underline underline-offset-4">Edit the place</a>
      </p>
    </div>
  );
}
