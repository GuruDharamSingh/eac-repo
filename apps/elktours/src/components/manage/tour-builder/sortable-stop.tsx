"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, BookMarked, GripVertical, RotateCcw, Sparkles, Trash2, Upload } from "lucide-react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { Badge, Button, Input, Label } from "@elkdonis/primitives";
import { MediaField } from "@/components/manage/media-field";
import { PlaceSearch } from "@/components/manage/place-search";
import type { StopDraft } from "@/components/manage/tour-builder/draft";

interface SortableStopProps {
  draft: StopDraft;
  index: number;
  count: number;
  selected: boolean;
  /** Title of the linked catalogue place or experience, when it is loaded. */
  linkLabel: string | null;
  onSelect: () => void;
  onChange: (patch: Partial<StopDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onReset: (() => void) | null;
  onUpdateCatalogue: (() => void) | null;
  updateHint: string | null;
}

/** One stop in the builder list: a drag handle, Up/Down for keyboard, and the editor when selected. */
export function SortableStop({
  draft: s, index, count, selected, linkLabel, onSelect, onChange, onMove, onRemove, onReset, onUpdateCatalogue, updateHint,
}: SortableStopProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: s.key });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined };
  const [search, setSearch] = React.useState("");
  const placed = s.lat.trim() !== "" && s.lng.trim() !== "";

  return (
    <li ref={setNodeRef} style={style} className={`border bg-card ${selected ? "border-primary" : "border-border"} ${isDragging ? "shadow-lg" : ""}`}>
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder ${s.title || "stop"}`}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <span className="tour-pin is-active" style={{ transform: "none" }}>{index + 1}</span>
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left" aria-expanded={selected}>
          <span className="block truncate font-medium">{s.title || "Untitled stop"}</span>
          <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {s.experienceId ? (
              <Badge variant="secondary"><Sparkles className="size-3" aria-hidden /> experience</Badge>
            ) : s.placeId ? (
              <Badge variant="outline"><BookMarked className="size-3" aria-hidden /> catalogue</Badge>
            ) : null}
            {!placed && <span>no position</span>}
            {s.dirty && <span className="text-amber-600">unsaved</span>}
          </span>
        </button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">
          <ArrowUp className="size-4" aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move down">
          <ArrowDown className="size-4" aria-hidden />
        </Button>
      </div>

      {selected && (
        <div className="space-y-4 border-t border-border p-3">
          {(s.placeId || s.experienceId) && (
            <div className="space-y-2 border border-border bg-muted/30 p-2 text-xs">
              <p className="text-muted-foreground">
                Copied from {s.experienceId ? "experience" : "catalogue place"}{" "}
                <span className="font-medium text-foreground">{linkLabel ?? "(not loaded)"}</span>. Edits here stay in this tour.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="xs" variant="outline" onClick={onReset ?? undefined} disabled={!onReset}>
                  <RotateCcw className="size-3" aria-hidden /> Reset stop to {s.experienceId ? "experience" : "catalogue"}
                </Button>
                {s.placeId && !s.experienceId && (
                  <Button type="button" size="xs" variant="outline" onClick={onUpdateCatalogue ?? undefined} disabled={!onUpdateCatalogue} title={updateHint ?? undefined}>
                    <Upload className="size-3" aria-hidden /> Update catalogue from this stop
                  </Button>
                )}
              </div>
              {updateHint && s.placeId && !s.experienceId && <p className="text-muted-foreground">{updateHint}</p>}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
            <div>
              <Label>Title</Label>
              <Input value={s.title} onChange={(e) => onChange({ title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Minutes</Label>
              <Input type="number" min={0} value={s.durationMinutes} onChange={(e) => onChange({ durationMinutes: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Position</Label>
            <PlaceSearch
              value={search}
              onChange={setSearch}
              onPick={(hit) => { onChange({ lat: String(hit.lat), lng: String(hit.lng), title: s.title || hit.label.split(",")[0] || s.title }); setSearch(""); }}
              placeholder="Search an address or landmark"
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Input value={s.lat} onChange={(e) => onChange({ lat: e.target.value })} placeholder="Lat" inputMode="decimal" aria-label="Latitude" />
              <Input value={s.lng} onChange={(e) => onChange({ lng: e.target.value })} placeholder="Lng" inputMode="decimal" aria-label="Longitude" />
              <Input value={s.heading} onChange={(e) => onChange({ heading: e.target.value })} placeholder="Heading" inputMode="decimal" aria-label="Heading" />
              <Input value={s.pitch} onChange={(e) => onChange({ pitch: e.target.value })} placeholder="Pitch" inputMode="decimal" aria-label="Pitch" />
              <Input value={s.fov} onChange={(e) => onChange({ fov: e.target.value })} placeholder="FOV" inputMode="decimal" aria-label="Field of view" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Heading is the compass direction Street View faces (0 north, 90 east).</p>
          </div>
          <MediaField value={s.imageUrl} onChange={(url) => onChange({ imageUrl: url })} label="Photo (shown where Street View is not)" />
          <div>
            <Label>What happens here</Label>
            <div className="mt-1">
              <RichTextEditor value={s.body} onChange={(html) => onChange({ body: html })} toolbar="compact" />
            </div>
          </div>
          <div>
            <Label>Guide notes <span className="text-muted-foreground">(private, never shown to visitors)</span></Label>
            <div className="mt-1">
              <RichTextEditor value={s.guideNotes} onChange={(html) => onChange({ guideNotes: html })} toolbar="compact" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden /> Remove stop
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
