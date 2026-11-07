"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { Button, Input, Label, Textarea } from "@elkdonis/primitives";
import { PlaceSearch } from "@/components/manage/place-search";
import { PersonAvatar } from "@/components/experiences/people-chips";
import { archiveAssetAction, upsertAssetAction } from "@/lib/asset-actions";
import {
  listServiceOptionsAction,
  saveExperienceAction,
  searchPeopleAction,
  setExperiencePeopleAction,
} from "@/lib/experience-actions";
import type {
  Experience,
  ExperienceFormat,
  ExperienceInput,
  ExperienceVisibility,
  ExperiencePersonRole,
  PersonOption,
  ServiceOption,
} from "@/lib/catalogue-types";

/** A picture already attached to the experience (an `image` asset row). */
export interface ExperienceImage {
  id: string;
  url: string;
}

interface Linked {
  userId: string;
  role: ExperiencePersonRole;
  name: string;
  avatarUrl: string | null;
}

const FORMATS: { value: ExperienceFormat; label: string }[] = [
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Both" },
];

const CURRENCIES = ["EUR", "USD", "GBP", "CAD"];

/**
 * Create or edit an experience: its own words, where and how it happens, a
 * display price (Phase A is inquiry only, nothing is charged), the linked
 * artists and hosts, and the artist's service listing on ArtDirect.
 * Only the title is required.
 */
export function ExperienceForm({
  experience,
  images = [],
  personOptions = [],
  serviceOptions = [],
}: {
  experience?: Experience;
  images?: ExperienceImage[];
  /** Initial picker list (org members and artists); typing searches for more. */
  personOptions?: PersonOption[];
  /** The first artist's public services, when the page could load them. */
  serviceOptions?: ServiceOption[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState({
    title: experience?.title ?? "",
    excerpt: experience?.excerpt ?? "",
    body: experience?.body ?? "",
    coverImageUrl: experience?.coverImageUrl ?? "",
    location: experience?.location ?? "",
    lat: experience?.lat ?? null as number | null,
    lng: experience?.lng ?? null as number | null,
    format: (experience?.format ?? "in_person") as ExperienceFormat,
    durationMinutes: experience?.durationMinutes != null ? String(experience.durationMinutes) : "",
    price: experience?.price != null ? String(experience.price) : "",
    currency: experience?.currency || "EUR",
    highlights: experience?.highlights.join("\n") ?? "",
    serviceThreadId: experience?.serviceThreadId ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const [people, setPeople] = React.useState<Linked[]>(
    () => [...(experience?.people ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ userId: p.userId, role: p.role, name: p.name, avatarUrl: p.avatarUrl }))
  );
  const initialPeople = React.useMemo(
    () => JSON.stringify((experience?.people ?? []).slice().sort((a, b) => a.position - b.position).map((p) => [p.userId, p.role])),
    [experience]
  );

  // The service picker lists the FIRST artist's public services; reload when that artist changes.
  const firstArtist = people.find((p) => p.role === "artist")?.userId ?? null;
  const [services, setServices] = React.useState<ServiceOption[]>(serviceOptions);
  const [servicesFor, setServicesFor] = React.useState<string | null>(
    experience?.people.find((p) => p.role === "artist")?.userId ?? null
  );
  React.useEffect(() => {
    if (firstArtist === servicesFor) return;
    setServicesFor(firstArtist);
    if (!firstArtist) { setServices([]); return; }
    let live = true;
    listServiceOptionsAction(firstArtist)
      .then((s) => { if (live) setServices(s); })
      .catch(() => { if (live) setServices([]); });
    return () => { live = false; };
  }, [firstArtist, servicesFor]);

  const [gallery, setGallery] = React.useState<ExperienceImage[]>(images);
  // Everything is public for now (2026-11-02): a published experience is for everyone.
  // "Members only" (ORGANIZATION) stays in the model but is not offered.
  const visibility: ExperienceVisibility = "PUBLIC";

  function submit(status: "draft" | "published") {
    const title = f.title.trim();
    if (!title) return void toast.error("A title is needed.");
    const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));
    const input: ExperienceInput = {
      title,
      excerpt: f.excerpt.trim() || null,
      body: f.body || null,
      coverImageUrl: f.coverImageUrl || null,
      location: f.format === "online" ? null : f.location.trim() || null,
      lat: f.format === "online" ? null : f.lat,
      lng: f.format === "online" ? null : f.lng,
      isOnline: f.format !== "in_person",
      format: f.format,
      durationMinutes: num(f.durationMinutes),
      price: num(f.price),
      currency: f.currency,
      highlights: f.highlights.split("\n").map((h) => h.trim()).filter(Boolean),
      serviceThreadId: f.serviceThreadId || null,
      // The save rewrites the experience's metadata: keep its catalogue place.
      placeId: experience?.placeId ?? null,
      status,
      visibility,
    };
    start(async () => {
      try {
        const r = await saveExperienceAction(input, experience?.id);
        if (r.ok === false) return void toast.error(r.error);
        const now = JSON.stringify(people.map((p) => [p.userId, p.role]));
        if (now !== initialPeople) {
          const pr = await setExperiencePeopleAction(r.id, people.map((p) => ({ userId: p.userId, role: p.role })));
          if (pr.ok === false) toast.error(`Saved, but the people were not: ${pr.error}`);
        }
        toast.success(status === "published" ? "Published" : "Saved");
        if (!experience) router.push(`/manage/experiences/${r.id}`);
        else router.refresh();
      } catch (x) {
        toast.error(x instanceof Error ? x.message : "Could not save.");
      }
    });
  }

  async function addImage(url: string) {
    if (!experience || !url) return;
    try {
      const r = await upsertAssetAction({ threadId: experience.id, kind: "image", role: "gallery", url, source: "upload", visible: true, position: gallery.length });
      if (r.ok === false) return void toast.error(r.error);
      setGallery((g) => [...g, { id: r.asset.id, url: r.asset.url ?? url }]);
    } catch (x) {
      toast.error(x instanceof Error ? x.message : "Could not add the picture.");
    }
  }

  async function removeImage(id: string) {
    try {
      const r = await archiveAssetAction(id);
      if (r.ok === false) return void toast.error(r.error);
      setGallery((g) => g.filter((i) => i.id !== id));
    } catch (x) {
      toast.error(x instanceof Error ? x.message : "Could not remove the picture.");
    }
  }

  const published = experience?.status === "published";

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(published ? "published" : "draft"); }} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div>
          <Label htmlFor="exp-title">Title</Label>
          <Input id="exp-title" value={f.title} onChange={(e) => set("title", e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="exp-excerpt">One-line summary</Label>
          <Textarea id="exp-excerpt" value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} maxLength={300} className="mt-1" />
        </div>
        <div>
          <Label>Description</Label>
          <div className="mt-1">
            <RichTextEditor value={f.body} onChange={(html) => set("body", html)} />
          </div>
        </div>
        <div>
          <Label htmlFor="exp-highlights">Highlights <span className="text-muted-foreground">(one per line)</span></Label>
          <Textarea id="exp-highlights" value={f.highlights} onChange={(e) => set("highlights", e.target.value)} rows={4} className="mt-1" />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Where</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Format">
            {FORMATS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={f.format === o.value}
                onClick={() => set("format", o.value)}
                className={`rounded-md border px-3 py-1.5 text-sm ${f.format === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent/30"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {f.format !== "online" ? (
            <div>
              <Label htmlFor="exp-location">Place</Label>
              <PlaceSearch
                id="exp-location"
                value={f.location}
                onChange={(v) => setF((s) => ({ ...s, location: v, lat: null, lng: null }))}
                onPick={(hit) => setF((s) => ({ ...s, location: hit.label, lat: hit.lat, lng: hit.lng }))}
                placeholder="The studio, gallery or address — search a landmark"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {f.lat != null && f.lng != null ? `On the map at ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}.` : "Pick a suggestion to place it on the map (needed to use it as a tour stop)."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Shown as &ldquo;Online&rdquo;. As a tour stop it has no map position.</p>
          )}
        </fieldset>

        <PeoplePicker people={people} setPeople={setPeople} options={personOptions} />

        <div>
          <Label htmlFor="exp-service">The artist&rsquo;s service listing</Label>
          <select
            id="exp-service"
            value={f.serviceThreadId}
            onChange={(e) => set("serviceThreadId", e.target.value)}
            disabled={!firstArtist && !f.serviceThreadId}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {f.serviceThreadId && !services.some((s) => s.threadId === f.serviceThreadId) && (
              <option value={f.serviceThreadId}>The linked service (not in this artist&rsquo;s list)</option>
            )}
            {services.map((s) => (
              <option key={s.threadId} value={s.threadId}>
                {s.title}{s.price != null ? ` — ${s.price} ${s.currency ?? ""}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {firstArtist
              ? services.length === 0 ? "This artist has no public service listed on ArtDirect." : "Visitors get a link to it beside the artist."
              : "Add an artist first; their public services are listed here."}
          </p>
        </div>
      </div>

      <aside className="space-y-6">
        <MediaPicker
          value={f.coverImageUrl || undefined}
          onChange={(url) => set("coverImageUrl", url)}
          uploadEndpoint="/api/upload"
          libraryEndpoint="/api/media/library"
          uploadFields={{ visibility: "PUBLIC" }}
          label="Cover image"
          hint="On the card and across the top of the page."
        />
        {f.coverImageUrl && (
          <Button type="button" variant="outline" size="sm" onClick={() => set("coverImageUrl", "")}>Remove cover</Button>
        )}

        <div className="space-y-2">
          <span className="text-sm font-medium">More pictures</span>
          {experience ? (
            <>
              {gallery.length > 0 && (
                <ul className="grid grid-cols-3 gap-2">
                  {gallery.map((img) => (
                    <li key={img.id} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      <button type="button" aria-label="Remove picture" onClick={() => removeImage(img.id)} className="absolute right-1 top-1 rounded bg-background/90 p-0.5 shadow">
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <MediaPicker
                key={gallery.length}
                onChange={(url) => void addImage(url)}
                uploadEndpoint="/api/upload"
                libraryEndpoint="/api/media/library"
                uploadFields={{ visibility: "PUBLIC" }}
                label="Add a picture"
                preview="none"
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Save the experience first, then add pictures here.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="exp-duration">Length (min)</Label>
            <Input id="exp-duration" type="number" min={0} step={15} value={f.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="exp-price">Price</Label>
            <div className="mt-1 flex gap-1">
              <Input id="exp-price" type="number" min={0} step="0.01" value={f.price} onChange={(e) => set("price", e.target.value)} />
              <select aria-label="Currency" value={f.currency} onChange={(e) => set("currency", e.target.value)} className="rounded-md border border-border bg-background px-1 text-sm">
                {Array.from(new Set([f.currency, ...CURRENCIES])).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">Shown as an indication only. Visitors send an inquiry; nothing is charged.</p>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          Drafts are seen by editors only. Published experiences are public.
        </p>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" disabled={pending} onClick={() => submit("draft")}>
            {published ? "Unpublish & save" : "Save draft"}
          </Button>
          <Button type="button" disabled={pending} onClick={() => submit("published")}>
            {published ? "Save" : "Publish"}
          </Button>
        </div>
      </aside>
    </form>
  );
}

/** Artists and hosts: linked people (name and picture come from their account), in order, with a search to add more. */
function PeoplePicker({ people, setPeople, options }: {
  people: Linked[];
  setPeople: React.Dispatch<React.SetStateAction<Linked[]>>;
  options: PersonOption[];
}) {
  const [role, setRole] = React.useState<ExperiencePersonRole>("artist");
  const [q, setQ] = React.useState("");
  const [found, setFound] = React.useState<PersonOption[]>(options);

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setFound(options); return; }
    let live = true;
    const t = setTimeout(() => {
      searchPeopleAction(term)
        .then((r) => { if (live) setFound(r); })
        .catch(() => { if (live) setFound(options.filter((o) => o.name.toLowerCase().includes(term.toLowerCase()))); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q, options]);

  const taken = new Set(people.filter((p) => p.role === role).map((p) => p.userId));
  const choices = found.filter((o) => !taken.has(o.userId)).slice(0, 8);

  const move = (i: number, d: -1 | 1) => setPeople((list) => {
    const same = list.map((p, idx) => ({ p, idx })).filter((x) => x.p.role === list[i].role);
    const at = same.findIndex((x) => x.idx === i);
    const other = same[at + d];
    if (!other) return list;
    const next = list.slice();
    [next[i], next[other.idx]] = [next[other.idx], next[i]];
    return next;
  });

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Artists and hosts</legend>
      <p className="text-xs text-muted-foreground">
        Artists are linked, not copied: their name, picture and ArtDirect profile come from their account. The host guides the visit.
      </p>
      {(["artist", "host"] as const).map((r) => {
        const list = people.map((p, i) => ({ p, i })).filter((x) => x.p.role === r);
        return (
          <div key={r}>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{r === "artist" ? "Artists" : "Hosts"}</p>
            {list.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {list.map(({ p, i }) => (
                  <li key={`${p.role}-${p.userId}`} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                    <PersonAvatar person={p} size={24} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowUp className="size-3.5" aria-hidden /></button>
                    <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowDown className="size-3.5" aria-hidden /></button>
                    <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPeople((l) => l.filter((_, idx) => idx !== i))} className="p-1 text-muted-foreground hover:text-foreground"><X className="size-3.5" aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className="rounded-md border border-dashed border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Add</span>
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as ExperiencePersonRole)} className="rounded-md border border-border bg-background px-2 py-1 text-sm">
            <option value="artist">as artist</option>
            <option value="host">as host</option>
          </select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="h-8 min-w-0 flex-1" aria-label="Search people" />
        </div>
        {choices.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {choices.map((o) => (
              <li key={o.userId}>
                <button
                  type="button"
                  onClick={() => setPeople((l) => [...l, { userId: o.userId, role, name: o.name, avatarUrl: o.avatarUrl }])}
                  className="inline-flex items-center gap-2 rounded-full border border-border py-0.5 pl-0.5 pr-3 text-sm hover:bg-accent/30"
                >
                  <PersonAvatar person={o} size={22} />
                  {o.name}
                  <span className="text-xs text-muted-foreground">{o.role}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{q.trim().length >= 2 ? "No one by that name." : "No people to suggest yet; type a name."}</p>
        )}
      </div>
    </fieldset>
  );
}
