"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import { Chip, PrimaryButton } from "@/components/mobile";
import { Field, FormTop } from "./board-bits";
import { savePlaceAction } from "@/lib/place-actions";
import { setPlaceWebsiteAction } from "@/lib/place-website-actions";
import { toggleFavouritePlaceAction } from "@/lib/place-favourite-actions";

// Screen 38, Add / edit a place (G7b), the phone tree of /manage/places/[id]. Save needs a name and an area. The kind
// chips are stored as one of the tags (the place record has no kind column), so they also filter the catalogue.
// The star features the place on Discover (toggleFavouritePlaceAction); the website is saved by setPlaceWebsiteAction.

const KINDS = ["gallery", "studio", "shop", "food & drink", "landmark"];
const KIND_LABEL: Record<string, string> = { gallery: "Gallery", studio: "Studio", shop: "Shop", "food & drink": "Food & drink", landmark: "Landmark" };

export function PlaceEditView({
  place,
  allTags,
  website,
  favourite,
}: {
  place: { id: string; title: string; address: string | null; excerpt: string | null; tags: string[] };
  allTags: string[];
  website: string;
  favourite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(place.title);
  const [area, setArea] = useState(place.address ?? "");
  const [site, setSite] = useState(website);
  const [blurb, setBlurb] = useState(place.excerpt ?? "");
  const [tags, setTags] = useState<string[]>(place.tags);
  const [tagIn, setTagIn] = useState("");
  const [fav, setFav] = useState(favourite);
  const [error, setError] = useState<string | null>(null);

  const kindNow = KINDS.find((k) => tags.includes(k)) ?? null;
  const shown = [...new Set([...allTags, ...tags])].filter((t) => !KINDS.includes(t)).sort();
  const ready = name.trim().length > 1 && area.trim().length > 0;

  const setKind = (k: string) => setTags((prev) => [...prev.filter((t) => !KINDS.includes(t)), ...(kindNow === k ? [] : [k])]);
  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const addTag = () => {
    const t = tagIn.trim().toLowerCase().slice(0, 40);
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagIn("");
  };

  function star() {
    const next = !fav;
    setFav(next);
    start(async () => {
      const r = await toggleFavouritePlaceAction(place.id, next);
      if (!r.ok) {
        setFav(!next);
        return void failToast(r.error);
      }
      toast.success(next ? "Featured on Discover under Favourite places." : "Taken off Favourite places.");
      router.refresh();
    });
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await savePlaceAction({ id: place.id, title: name.trim(), address: area.trim(), excerpt: blurb.trim() || null, tags });
      if (!r.ok) return setError(r.error);
      if (site.trim() !== website) {
        const w = await setPlaceWebsiteAction(place.id, site);
        if (!w.ok) return setError(w.error);
      }
      toast.success("Place saved");
      router.refresh();
    });
  }

  return (
    <div className="bf">
      <FormTop href="/manage/places" kicker="Places" title="Edit place" />
      <div className="bf-body">
        <div className="bf-row">
          <span className="bf-row-text">Feature on Discover<small>Shows under Favourite places.</small></span>
          <button type="button" className="bf-star" aria-pressed={fav} aria-label={fav ? "Remove from favourites" : "Add to favourites"} disabled={pending} onClick={star}>
            {fav ? "★" : "☆"}
          </button>
        </div>
        <Field label="Name">
          <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Kind">
          <div className="bf-wrap">
            {KINDS.map((k) => (
              <Chip key={k} selected={kindNow === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</Chip>
            ))}
          </div>
        </Field>
        <Field label="Address or area">
          <input className="m-field" value={area} onChange={(e) => setArea(e.target.value)} />
        </Field>
        <Field label="Website · optional">
          <input className="m-field" value={site} onChange={(e) => setSite(e.target.value)} inputMode="url" autoCapitalize="none" placeholder="example.com" />
        </Field>
        <Field label="Why you like it">
          <textarea className="m-field" value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={200} />
        </Field>
        <p className="bf-note">Guests read this on the place card. One or two lines.</p>
        <Field label="Tags · guests filter the catalogue by these">
          <div className="bf-wrap">
            {shown.map((t) => (
              <Chip key={t} selected={tags.includes(t)} onClick={() => toggleTag(t)}>{t}</Chip>
            ))}
          </div>
          <div className="bf-tagadd">
            <input
              className="m-field"
              value={tagIn}
              onChange={(e) => setTagIn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="New tag"
            />
            <button type="button" onClick={addTag}>Add</button>
          </div>
        </Field>
        {error && <p className="bf-err" role="alert">{error}</p>}
      </div>
      <div className="bf-bar">
        <PrimaryButton disabled={!ready || pending} onClick={save}>{pending ? "Saving…" : "Save changes"}</PrimaryButton>
      </div>
    </div>
  );
}
