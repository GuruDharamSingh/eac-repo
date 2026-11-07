"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Experience, ExperienceInput, ExperienceVisibility } from "@/lib/catalogue-types";
import { saveExperienceAction, setExperienceStatusAction } from "@/lib/experience-actions";

/** Who sees an experience: a draft (editors), members of the org, or everyone. */
export type ExperienceAudience = "draft" | "members" | "public";

export const AUDIENCE_LABEL: Record<ExperienceAudience, string> = {
  draft: "Draft",
  members: "Members only",
  public: "Public",
};

export const AUDIENCE_HINT: Record<ExperienceAudience, string> = {
  draft: "Only editors see it.",
  members: "Published for signed-in members of the collective; never on public pages.",
  public: "On the site for everyone.",
};

export function audienceOf(e: Pick<Experience, "status" | "visibility">): ExperienceAudience {
  if (e.status !== "published") return "draft";
  return e.visibility === "ORGANIZATION" ? "members" : "public";
}

export function visibilityFor(a: ExperienceAudience): ExperienceVisibility {
  return a === "members" ? "ORGANIZATION" : "PUBLIC";
}

/**
 * Every field saveExperienceAction writes, from the stored experience. The
 * action rewrites the whole row, so changing only the audience must resend
 * the rest unchanged (place and service links included).
 */
export function experienceToInput(e: Experience): ExperienceInput {
  return {
    title: e.title,
    body: e.body,
    excerpt: e.excerpt,
    coverImageUrl: e.coverImageUrl,
    location: e.location,
    isOnline: e.isOnline,
    durationMinutes: e.durationMinutes,
    price: e.price,
    currency: e.currency,
    format: e.format,
    highlights: e.highlights,
    lat: e.lat,
    lng: e.lng,
    serviceThreadId: e.serviceThreadId,
    placeId: e.placeId ?? null,
  };
}

/**
 * Everything is public for now (Justin, 2026-11-02): the selector offers
 * Draft and Public. "Members only" stays in the model and is listed only for
 * a row that is already members-only, so the selector never misreports it.
 */
const OFFERED: ExperienceAudience[] = ["draft", "public"];

/**
 * The draft / public selector on /manage/experiences.
 * Archived experiences show their state and are restored from the row's
 * actions instead.
 */
export function ExperienceAudienceSelect({ experience }: { experience: Experience }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const current = audienceOf(experience);

  if (experience.status === "archived") {
    return <span className="text-sm text-muted-foreground">Archived</span>;
  }

  function change(next: ExperienceAudience) {
    if (next === current) return;
    start(async () => {
      try {
        const r =
          next === "draft"
            ? await setExperienceStatusAction(experience.id, "draft")
            : await saveExperienceAction(
                { ...experienceToInput(experience), status: "published", visibility: visibilityFor(next) },
                experience.id
              );
        if (r.ok === false) return void toast.error(r.error);
        toast.success(`${experience.title}: ${AUDIENCE_LABEL[next].toLowerCase()}`);
        router.refresh();
      } catch (x) {
        toast.error(x instanceof Error ? x.message : "Could not change who sees it.");
      }
    });
  }

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => change(e.target.value as ExperienceAudience)}
      aria-label={`Who sees ${experience.title}`}
      title={AUDIENCE_HINT[current]}
      className="h-8 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
    >
      {(current === "members" ? (["draft", "members", "public"] as ExperienceAudience[]) : OFFERED).map((a) => (
        <option key={a} value={a}>
          {AUDIENCE_LABEL[a]}
        </option>
      ))}
    </select>
  );
}
