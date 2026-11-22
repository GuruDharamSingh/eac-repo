"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import "@/blocks/mobile/flow.css";
import "@/blocks/mobile/people.css";
import { BackButton, Chip, PrimaryButton } from "@/components/mobile";
import { submitSuggestionAction } from "@/lib/suggest-lead-actions";

// Screen 14, Suggest (G4). Code screen with fixed copy. Send needs a name and a web address or a reason. The action
// answers "available after migration" until the draft migration is applied; that and any other refusal show as a
// gentle toast, not an error box.

export function SuggestView() {
  const router = useRouter();
  const [kind, setKind] = useState<"artist" | "place">("artist");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [why, setWhy] = useState("");
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const ready = name.trim().length > 0 && (url.trim().length > 0 || why.trim().length > 0);
  const noun = kind === "artist" ? "artist" : "place";

  function send() {
    start(async () => {
      const r = await submitSuggestionAction({ kind, name, url: url || null, why: why || null, email: email || null });
      if (r.ok) {
        toast.success("Thank you. The office reads every suggestion.");
        router.push("/");
      } else {
        failToast(r.error);
      }
    });
  }

  return (
    <div className="elk-m m-col">
      <div className="m-flow-top">
        <BackButton href="/" />
        <div className="m-flow-top-text">
          <span className="m-kicker">Suggest</span>
          <span className="m-flow-top-title">An artist or a place</span>
        </div>
      </div>
      <div className="m-suggest-types">
        <Chip selected={kind === "artist"} onClick={() => setKind("artist")}>An artist</Chip>
        <Chip selected={kind === "place"} onClick={() => setKind("place")}>A place</Chip>
      </div>
      <div className="m-suggest-fields">
        <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} placeholder={`The ${noun}'s name`} aria-label="Name" />
        <input className="m-field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="A web address" inputMode="url" aria-label="Web address" />
        <textarea className="m-field" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={`Why this ${noun}?`} aria-label="Why" />
        <input className="m-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email (optional)" aria-label="Your email" />
      </div>
      <div className="m-flow-bar">
        <PrimaryButton disabled={!ready || pending} onClick={send}>{pending ? "Sending…" : "Send"}</PrimaryButton>
      </div>
    </div>
  );
}
