"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Chip, PrimaryButton, roman } from "@/components/mobile";
import { Field, FormTop, Stepper, Switch } from "./board-bits";
import {
  saveArtistProfileAction,
  saveAvailabilityAction,
  saveExperienceDraftAction,
  submitExperienceForReviewAction,
} from "@/lib/artist-wizard-actions";

// Screen 35, artist sign-up and new experience (G7b). Four steps, fixed copy. Validation follows data-and-state
// "Validation": I name (and an email with @ for a new artist), II title + pitch + place unless online, III one cell,
// IV one of the two offers. The last step saves the profile, the availability and the draft, then sends it for review.

const CRAFTS = ["Painter", "Sculptor", "Performer", "Musician", "Maker", "Writer", "Cook", "Photographer"];
const KINDS = ["Performance", "Hands-on", "Demonstration", "Listening", "Tasting", "Open studio"];
const FORMATS: Array<{ id: "in_person" | "online" | "hybrid"; label: string }> = [
  { id: "in_person", label: "In person" },
  { id: "online", label: "Online" },
  { id: "hybrid", label: "Hybrid" },
];
const PARTS = ["morning", "afternoon", "evening"] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NOTICES: Array<{ id: 1 | 2 | 7; label: string }> = [
  { id: 1, label: "1 day" },
  { id: 2, label: "2 days" },
  { id: 7, label: "1 week" },
];
const STEPS = ["You", "Experience", "Free", "Offer"];

export interface WizardInitial {
  id: string | null;
  title: string;
  pitch: string;
  format: "in_person" | "online" | "hybrid";
  placeId: string | null;
  durationMinutes: number | null;
  groupSize: number | null;
  offer: {
    onTour: { fee: number; unit: "per_run" | "per_guest" } | null;
    standalone: { pricePerGuest: number } | null;
    noticeDays: 1 | 2 | 7;
    visibilityWanted: "members" | "public";
  } | null;
  /** Review notes when the office sent it back. */
  notes: string | null;
}

export function ArtistWizardView({
  isNew,
  viewer,
  places,
  availability,
  initial,
  home = "/manage",
}: {
  home?: string;
  isNew: boolean;
  viewer: { name: string; email: string; craft?: string; area?: string; about?: string };
  places: Array<{ id: string; title: string }>;
  availability: { available: boolean; cells: Array<{ weekday: number; part: string }>; noticeDays: 1 | 2 | 7 };
  initial: WizardInitial;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(initial.id);

  // I
  const [name, setName] = useState(viewer.name);
  const [email, setEmail] = useState(viewer.email);
  const [craft, setCraft] = useState(viewer.craft ?? "");
  const [area, setArea] = useState(viewer.area ?? "");
  const [about, setAbout] = useState(viewer.about ?? "");
  // II
  const [title, setTitle] = useState(initial.title);
  const [pitch, setPitch] = useState(initial.pitch);
  const [kind, setKind] = useState("");
  const [format, setFormat] = useState(initial.format);
  const [placeId, setPlaceId] = useState<string | null>(initial.placeId);
  const [mins, setMins] = useState(initial.durationMinutes ?? 60);
  const [group, setGroup] = useState(initial.groupSize ?? 6);
  // III
  const [cells, setCells] = useState<Set<string>>(() => new Set(availability.cells.map((c) => `${c.weekday}:${c.part}`)));
  const [notice, setNotice] = useState<1 | 2 | 7>(initial.offer?.noticeDays ?? availability.noticeDays);
  // IV
  const [asStop, setAsStop] = useState(initial.offer ? Boolean(initial.offer.onTour) : true);
  const [fee, setFee] = useState(initial.offer?.onTour?.fee ?? 90);
  const [unit, setUnit] = useState<"per_run" | "per_guest">(initial.offer?.onTour?.unit ?? "per_run");
  const [onOwn, setOnOwn] = useState(Boolean(initial.offer?.standalone));
  const [priv, setPriv] = useState(initial.offer?.standalone?.pricePerGuest ?? 40);
  const [vis, setVis] = useState<"members" | "public">(initial.offer?.visibilityWanted ?? "public");

  const valid = [
    name.trim().length > 0 && (!isNew || email.includes("@")),
    title.trim().length >= 2 && pitch.trim().length > 0 && (format === "online" || Boolean(placeId)),
    cells.size > 0,
    asStop || onOwn,
  ];
  const heading = [isNew ? "Join as an artist" : "About you", "What will happen?", "When are you free?", "How it is offered"][step];
  const sub = [
    isNew ? "Artists and residents who host experiences get a public page, and a board where guides invite them onto tours." : "This is what guests read on your page.",
    "Tell guests what they will see or do that they will not find anywhere else.",
    "Guides plan stops around this. Tap the parts of the week that usually work for you.",
    "The office reads every new experience before it goes up.",
  ][step];

  const toggleCell = (wd: number, part: string) =>
    setCells((prev) => {
      const next = new Set(prev);
      const k = `${wd}:${part}`;
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  function send() {
    setError(null);
    start(async () => {
      const profile = await saveArtistProfileAction({ name, craft, area, about });
      if (!profile.ok) return setError(profile.error);
      const av = await saveAvailabilityAction(
        [...cells].map((k) => ({ weekday: Number(k.split(":")[0]), part: k.split(":")[1] as (typeof PARTS)[number] })),
        notice
      );
      if (!av.ok) return setError(av.error);
      const saved = await saveExperienceDraftAction(
        {
          title: title.trim(),
          pitch: pitch.trim(),
          kindLabel: kind || null,
          format,
          placeId: format === "online" ? null : placeId,
          durationMinutes: mins,
          groupSize: group,
          offer: {
            onTour: asStop ? { fee, unit } : null,
            standalone: onOwn ? { pricePerGuest: priv } : null,
            noticeDays: notice,
            visibilityWanted: vis,
          },
        },
        draftId ?? undefined
      );
      if (!saved.ok) return setError(saved.error);
      setDraftId(saved.id);
      const sent = await submitExperienceForReviewAction(saved.id);
      if (!sent.ok) return setError(sent.error);
      toast.success("Sent to the office. They read every new experience.");
      router.push(home);
    });
  }

  const placeName = places.find((p) => p.id === placeId)?.title;

  return (
    <div className="bf">
      <FormTop href={home} kicker={isNew ? "Artist sign-up" : "New experience"} title={`Step ${roman(step + 1)} of IV`} />
      <div className="bf-steps">
        {STEPS.map((l, i) => (
          <button key={l} type="button" className="bf-step" data-done={i < step} data-current={i === step} disabled={i >= step} onClick={() => setStep(i)}>
            <span className="bf-step-bar" />
            <span className="bf-step-label">{roman(i + 1)} · {l}</span>
          </button>
        ))}
      </div>

      <div className="bf-body">
        <h2 className="bf-h">{heading}</h2>
        <p className="bf-sub">{sub}</p>
        {initial.notes && step === 0 && <p className="bf-err">The office sent it back: {initial.notes}</p>}

        {step === 0 && (
          <>
            <Field label="Name">
              <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email">
              <input className="m-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
            </Field>
            <Field label="What you do">
              <div className="bf-wrap">
                {CRAFTS.map((c) => (
                  <Chip key={c} selected={craft === c} onClick={() => setCraft(craft === c ? "" : c)}>{c}</Chip>
                ))}
              </div>
            </Field>
            <Field label="Where you work">
              <input className="m-field" value={area} onChange={(e) => setArea(e.target.value)} placeholder="A street, a quarter" />
            </Field>
            <Field label="A few lines about you">
              <textarea className="m-field" value={about} onChange={(e) => setAbout(e.target.value)} />
            </Field>
            <p className="bf-note">Your name and area only fill gaps in your shared profile. Nothing you already set elsewhere is overwritten.</p>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Title">
              <input className="m-field" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="What will happen">
              <textarea className="m-field" value={pitch} onChange={(e) => setPitch(e.target.value)} maxLength={400} />
            </Field>
            <Field label="What kind">
              <div className="bf-wrap">
                {KINDS.map((k) => (
                  <Chip key={k} selected={kind === k} onClick={() => setKind(kind === k ? "" : k)}>{k}</Chip>
                ))}
              </div>
            </Field>
            <Field label="Format">
              <div className="bf-wrap">
                {FORMATS.map((f) => (
                  <Chip key={f.id} selected={format === f.id} onClick={() => setFormat(f.id)}>{f.label}</Chip>
                ))}
              </div>
            </Field>
            {format !== "online" && (
              <Field label="Where">
                <div className="bf-wrap">
                  {places.map((p) => (
                    <Chip key={p.id} selected={placeId === p.id} onClick={() => setPlaceId(placeId === p.id ? null : p.id)}>{p.title}</Chip>
                  ))}
                </div>
                {places.length === 0 && <p className="bf-note">The place catalogue is empty. Choose Online, or ask the office to add your place.</p>}
              </Field>
            )}
            <div className="bf-row">
              <span className="bf-row-text">Length</span>
              <Stepper value={`${mins} min`} label="length" onMinus={() => setMins(Math.max(5, mins - 5))} onPlus={() => setMins(Math.min(180, mins + 5))} />
            </div>
            <div className="bf-row">
              <span className="bf-row-text">Group size</span>
              <Stepper value={String(group)} label="group size" onMinus={() => setGroup(Math.max(1, group - 1))} onPlus={() => setGroup(Math.min(30, group + 1))} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bf-grid" role="group" aria-label="Free parts of the week">
              <span />
              {DAYS.map((d) => (
                <span key={d} className="bf-grid-h">{d}</span>
              ))}
              {PARTS.map((p) => (
                <FragmentRow key={p} part={p} cells={cells} onToggle={toggleCell} />
              ))}
            </div>
            <p className="bf-note">
              {cells.size ? `${cells.size} ${cells.size > 1 ? "parts" : "part"} of the week marked. You can change this any time.` : "Nothing marked yet."}
            </p>
            <Field label="Notice you need">
              <div className="bf-wrap">
                {NOTICES.map((n) => (
                  <Chip key={n.id} selected={notice === n.id} onClick={() => setNotice(n.id)}>{n.label}</Chip>
                ))}
              </div>
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <div className="bf-sub-card">
              <div className="bf-row">
                <span className="bf-row-text">As a stop on a tour<small>Guides add you to a tour and ask for each date.</small></span>
                <Switch on={asStop} onChange={setAsStop} label="As a stop on a tour" />
              </div>
              {asStop && (
                <>
                  <div className="bf-row">
                    <span className="bf-row-text">Fee</span>
                    <Stepper value={`€${fee}`} label="fee" onMinus={() => setFee(Math.max(0, fee - 5))} onPlus={() => setFee(fee + 5)} />
                  </div>
                  <div className="bf-wrap">
                    <Chip selected={unit === "per_run"} onClick={() => setUnit("per_run")}>per run</Chip>
                    <Chip selected={unit === "per_guest"} onClick={() => setUnit("per_guest")}>per guest</Chip>
                  </div>
                </>
              )}
            </div>
            <div className="bf-sub-card">
              <div className="bf-row">
                <span className="bf-row-text">On its own, by request<small>Guests ask for a private visit.</small></span>
                <Switch on={onOwn} onChange={setOnOwn} label="On its own, by request" />
              </div>
              {onOwn && (
                <div className="bf-row">
                  <span className="bf-row-text">Price per guest</span>
                  <Stepper value={`€${priv}`} label="price" onMinus={() => setPriv(Math.max(0, priv - 5))} onPlus={() => setPriv(priv + 5)} />
                </div>
              )}
            </div>
            <Field label="You would like it to be">
              <div className="bf-wrap">
                <Chip selected={vis === "members"} onClick={() => setVis("members")}>Members only</Chip>
                <Chip selected={vis === "public"} onClick={() => setVis("public")}>Public</Chip>
              </div>
            </Field>
            <div className="bf-preview">
              <strong>{title.trim() || "Your experience"}</strong>
              <span>
                {name || "You"}{kind ? ` · ${kind}` : ""} · {mins} min{format !== "online" && placeName ? ` · ${placeName}` : ""}
              </span>
            </div>
            {!(asStop || onOwn) && <p className="bf-note">Choose at least one way to offer it.</p>}
          </>
        )}

        {error && <p className="bf-err" role="alert">{error}</p>}
      </div>

      <div className="bf-bar">
        {step > 0 && (
          <button type="button" className="bf-ghost" onClick={() => setStep(step - 1)}>Back</button>
        )}
        <PrimaryButton
          disabled={!valid[step] || pending}
          onClick={() => (step < 3 ? setStep(step + 1) : send())}
        >
          {step < 3 ? "Continue" : pending ? "Sending…" : "Send for review"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function FragmentRow({ part, cells, onToggle }: { part: (typeof PARTS)[number]; cells: Set<string>; onToggle: (wd: number, part: string) => void }) {
  return (
    <>
      <span className="bf-grid-r">{part === "morning" ? "Morn." : part === "afternoon" ? "After." : "Eve."}</span>
      {DAYS.map((d, wd) => (
        <button key={d} type="button" className="bf-cell" aria-pressed={cells.has(`${wd}:${part}`)} aria-label={`${d} ${part}`} onClick={() => onToggle(wd, part)} />
      ))}
    </>
  );
}
