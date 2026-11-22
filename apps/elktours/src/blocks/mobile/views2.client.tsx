"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArchFrame, Chip, Porthole, Sheet } from "@/components/mobile";
import { PersonCard } from "./person-card";
import type { MobilePerson } from "./types";

// More interactive halves (G4): the people grid with chips, and the private-visit enquiry sheet.

export function PeopleGridView(p: { people: MobilePerson[]; chipAll?: ReactNode; chipGuides?: ReactNode; chipArtists?: ReactNode }) {
  const [kind, setKind] = useState<"all" | "guide" | "artist">("all");
  const shown = p.people.filter((x) => kind === "all" || x.kind === kind);
  return (
    <div className="blk-mpg">
      <div className="m-chip-row">
        <Chip selected={kind === "all"} onClick={() => setKind("all")}><span className="blk-mpg-chip-all">{p.chipAll}</span></Chip>
        <Chip selected={kind === "guide"} onClick={() => setKind("guide")}><span className="blk-mpg-chip-guides">{p.chipGuides}</span></Chip>
        <Chip selected={kind === "artist"} onClick={() => setKind("artist")}><span className="blk-mpg-chip-artists">{p.chipArtists}</span></Chip>
      </div>
      <div className="blk-mpg-grid">
        {shown.map((x) => (
          <PersonCard key={x.slug} x={x} />
        ))}
      </div>
    </div>
  );
}

const ExperienceInquiry = dynamic(() => import("@/components/experiences/experience-inquiry").then((m) => m.ExperienceInquiry), { ssr: false });

export function ExpPrivateView(p: { id: string; title: string; viewerEmail: string | null; note?: ReactNode; ctaLabel?: ReactNode; sheetTitle: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="blk blk-mxe">
      <p className="blk-mxe-note">{p.note}</p>
      <button type="button" className="blk-mxe-cta" onClick={() => setOpen(true)}>{p.ctaLabel}</button>
      <Sheet open={open} onOpenChange={setOpen} title={p.sheetTitle} tall>
        <div className="blk-mxe-sheet">
          <ExperienceInquiry threadId={p.id} title={p.title} signedInEmail={p.viewerEmail} />
        </div>
      </Sheet>
    </section>
  );
}
