"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import { Chip } from "@/components/mobile";
import { Field } from "./board-bits";
import "@/blocks/mobile/flow.css";
import "@/blocks/mobile/people.css";
import "./board-forms.css";
import { saveAvailabilityAction } from "@/lib/artist-wizard-actions";

// /artist, "My page" (G7c): profile, the 7 x 3 availability grid (saved on each tap) and my experiences.

const PARTS = ["morning", "afternoon", "evening"] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NOTICES: Array<{ id: 1 | 2 | 7; label: string }> = [{ id: 1, label: "1 day" }, { id: 2, label: "2 days" }, { id: 7, label: "1 week" }];

export interface MyExperienceRow { id: string; title: string; state: string; label: string; notes: string | null }

export function ArtistHomeView({
  name, email, availability, experiences, invitationCount,
}: {
  name: string; email: string;
  availability: { available: boolean; cells: Array<{ weekday: number; part: string }>; noticeDays: 1 | 2 | 7 };
  experiences: MyExperienceRow[];
  invitationCount: number;
}) {
  const [cells, setCells] = useState<Set<string>>(() => new Set(availability.cells.map((c) => `${c.weekday}:${c.part}`)));
  const [notice, setNotice] = useState<1 | 2 | 7>(availability.noticeDays);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const touched = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save each change after a short pause (~600 ms), so a run of taps is one write.
  useEffect(() => {
    if (!touched.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        const r = await saveAvailabilityAction([...cells].map((k) => ({ weekday: Number(k.split(":")[0]), part: k.split(":")[1] as (typeof PARTS)[number] })), notice);
        if (!r.ok) {
          setStatus("idle");
          failToast(r.error);
          return;
        }
        setStatus("saved");
      } catch {
        setStatus("idle");
        toast.error("Could not save. Try again.");
      }
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [cells, notice]);

  const toggle = (k: string) => { touched.current = true; setStatus("idle"); setCells((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; }); };

  return (
    <div className="bf">
      <div className="m-flow-top"><div className="m-flow-top-text"><span className="m-kicker">Artist</span><span className="m-flow-top-title">My page</span></div></div>
      <div className="bf-body">
        <div className="bf-card"><h3>{name || "You"}</h3><p className="bf-meta">{email}</p></div>
        <Link href="/artist/invitations" className="bf-dashed">Invitations{invitationCount ? ` (${invitationCount} waiting)` : ""}</Link>

        <div className="bf-field">
          <span className="bf-label">My experiences ({experiences.length})</span>
          {experiences.length === 0 && <p className="bf-note">Nothing yet.</p>}
          {experiences.map((e) => {
            const editable = e.state === "draft" || e.state === "sent_back";
            const body = (<><h3>{e.title}</h3><span className="bf-pill">{e.label}</span>{e.notes && <p>{e.notes}</p>}</>);
            return editable
              ? <Link key={e.id} href={`/artist/experiences/${e.id}`} className="bf-card" style={{ textDecoration: "none", color: "inherit" }}>{body}</Link>
              : <div key={e.id} className="bf-card">{body}</div>;
          })}
          <Link href="/artist/experiences/new" className="bf-dashed">+ New experience</Link>
        </div>

        <div className="bf-field">
          <span className="bf-label">When I am free{status === "saved" ? <span className="bf-saved" role="status"> · Saved ✓</span> : status === "saving" ? <span className="bf-saved"> · …</span> : null}</span>
          <div className="bf-grid" role="group" aria-label="Free parts of the week">
            <span />
            {DAYS.map((d) => <span key={d} className="bf-grid-h">{d}</span>)}
            {PARTS.map((p) => (
              <FragmentRow key={p} part={p} cells={cells} onToggle={toggle} />
            ))}
          </div>
        </div>
        <Field label="Notice you need">
          <div className="bf-wrap">
            {NOTICES.map((n) => <Chip key={n.id} selected={notice === n.id} onClick={() => { touched.current = true; setStatus("idle"); setNotice(n.id); }}>{n.label}</Chip>)}
          </div>
        </Field>
      </div>
    </div>
  );
}

function FragmentRow({ part, cells, onToggle }: { part: (typeof PARTS)[number]; cells: Set<string>; onToggle: (k: string) => void }) {
  return (
    <>
      <span className="bf-grid-r">{part === "morning" ? "Morn." : part === "afternoon" ? "After." : "Eve."}</span>
      {DAYS.map((d, wd) => <button key={d} type="button" className="bf-cell" aria-pressed={cells.has(`${wd}:${part}`)} aria-label={`${d} ${part}`} onClick={() => onToggle(`${wd}:${part}`)} />)}
    </>
  );
}
