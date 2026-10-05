"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TemplateWizard, type TemplateWizardStep } from "@elkdonis/cms-ui";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import {
  AUDIENCE_TYPE_LABELS,
  AUDIENCE_TYPE_VALUES,
  CLIENT_BASE_LABELS,
  CLIENT_BASE_VALUES,
  DISCIPLINE_LABELS,
  DISCIPLINE_VALUES,
  EXPERIENCE_LABELS,
  EXPERIENCE_VALUES,
  FEATURE_LABELS,
  FEATURE_VALUES,
  GOALS_OPTION_LABELS,
  GOALS_OPTION_VALUES,
  NEED_LABELS,
  NEED_VALUES,
  TEMPLATE_LABELS,
  TEMPLATE_VALUES,
  wizardSchema,
  type WizardAnswers,
} from "@/lib/schema";
import { KeywordInput } from "./KeywordInput";

// ============================================================================
// Artist profile wizard, on the same shared TemplateWizard as the guided
// workshop flow: labelled step chips at the top (any step reachable at any
// time), answers held in one draft and autosaved to /api/wizard/save, and the
// full schema checked only on the last step's button.
//
// It replaces eight hand-written react-hook-form steps, each of which kept its
// values locally until Continue, so a step could not be left without first
// passing its own validation. The answer keys, option lists and copy are the
// ones those steps used; the save and submit routes are unchanged in shape.
// ============================================================================

type Props = {
  /** Namespaces the browser draft; the same key the old provider used. */
  storageKey: string;
  initialAnswers: Partial<WizardAnswers>;
  serverUpdatedAt: string | null;
  /** Editing a completed profile: changes the finish label and destination. */
  editing: boolean;
};

const opts = <V extends string>(values: readonly V[], labels: Record<V, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const STEPS: TemplateWizardStep[] = [
  {
    id: "identity",
    label: "You",
    description:
      "These answers seed your public page. You can refine anything later from your account.",
    fields: [
      {
        name: "displayName",
        label: "Display name",
        input: "text",
        required: true,
        placeholder: "e.g. Mira Delacroix",
        hint: "How the collective will refer to you.",
      },
      {
        name: "pronouns",
        label: "Pronouns (optional)",
        input: "text",
        placeholder: "e.g. she/her, they/them",
      },
      {
        name: "city",
        label: "City / region",
        input: "text",
        required: true,
        placeholder: "e.g. Toronto, ON",
      },
      {
        name: "bio",
        label: "Short bio",
        input: "textarea",
        required: true,
        hint: "A few sentences the collective can use to introduce you.",
      },
      {
        name: "photoUrl",
        label: "Portrait (optional)",
        input: "custom",
        hint: "Upload an image, or choose one already in your files. It is stored in your own folder on the network.",
        // Uploads land in the artist's users/<slug>/Media/Images; the library
        // tab browses the same folder. Both routes take the slug from the
        // session, never from the request.
        render: ({ value, onChange }) => (
          <MediaPicker
            value={typeof value === "string" && value ? value : undefined}
            onChange={(url) => onChange(url)}
            uploadEndpoint="/api/my-files"
            uploadFields={{ folder: "Images" }}
            libraries={[{ key: "mine", label: "My files", endpoint: "/api/my-files" }]}
            // The field label above already names it; an empty span keeps the
            // tab row aligned.
            label=""
          />
        ),
      },
    ],
  },
  {
    id: "practice",
    label: "Practice",
    description:
      'Pick what fits. Anything else you practice can go in the "Other" field below.',
    fields: [
      {
        name: "disciplines",
        label: "Disciplines",
        input: "multichoice",
        required: true,
        options: opts(DISCIPLINE_VALUES, DISCIPLINE_LABELS),
      },
      {
        name: "disciplinesOther",
        label: "Other (optional)",
        input: "text",
        placeholder: "Anything else you practice...",
        hint: "Free-form — use whatever language you want.",
      },
      {
        name: "experienceLevel",
        label: "Where are you in your path?",
        input: "radio",
        required: true,
        options: opts(EXPERIENCE_VALUES, EXPERIENCE_LABELS),
      },
    ],
  },
  {
    id: "audience",
    label: "Audience",
    description: "Help us understand who you're making work for. All fields optional — add what feels relevant.",
    optional: true,
    fields: [
      {
        name: "portfolioUrl",
        label: "Show us some of your work (optional)",
        input: "url",
        placeholder: "https://... (DeviantArt, personal site, article, etc.)",
        hint: "A link to an existing portfolio, Substack, social, or article — any face of your practice online.",
      },
      {
        name: "audienceTypes",
        label: "Audience types",
        input: "multichoice",
        options: opts(AUDIENCE_TYPE_VALUES, AUDIENCE_TYPE_LABELS),
        hint: "Pick any that apply. Helps us shape features suited to you.",
      },
      {
        name: "clientBase",
        label: "Client base",
        input: "multichoice",
        options: opts(CLIENT_BASE_VALUES, CLIENT_BASE_LABELS),
        hint: "Who are the people your work is for?",
      },
      {
        name: "audienceDescription",
        label: "Anything else about them? (optional)",
        input: "textarea",
        placeholder: "A sentence or two about experience working with them so far, if any.",
      },
    ],
  },
  {
    id: "goals",
    label: "Goals",
    description: "Pick any that resonate. This is preliminary — none of it fully obligates you.",
    optional: true,
    fields: [
      {
        name: "goalsOptions",
        label: "What are you here for?",
        input: "multichoice",
        options: opts(GOALS_OPTION_VALUES, GOALS_OPTION_LABELS),
      },
      {
        name: "mutualAidMedia",
        label: "Mutual aid: I'm open to giving other collective artists access to my media / fanbase.",
        input: "boolean",
        hint: "Preliminary interest. Deeper partnerships with Elkdonis are opt-in and walked through in a separate legal/contracts step. Common-sense defaults apply until then.",
      },
      {
        name: "mutualAidAuthoring",
        label: "Mutual aid: I'm interested in authoring content under the Elkdonis Arts Collective name.",
        input: "boolean",
      },
      {
        name: "goalsNote",
        label: "Anything specific you want to say here? (optional)",
        input: "textarea",
        placeholder: "Assets, skills, specific asks...",
        hint: "A short, honest note — whatever you'd want the team to know.",
      },
    ],
  },
  {
    id: "view",
    label: "Your view",
    description:
      "A short pass at your personal philosophy and aesthetic bearings. Helps us relate your corner to others in the collective.",
    optional: true,
    fields: [
      {
        name: "personalPhilosophy",
        label: "Personal philosophy (optional)",
        input: "textarea",
        placeholder:
          "What you believe your work is doing. What you're after. The stance you make from.",
      },
      {
        name: "aestheticKeywords",
        label: "Aesthetic alignments",
        input: "custom",
        hint: "Keywords that describe the look, feel, or movement your work sits in.",
        render: ({ value, onChange }) => (
          <KeywordInput
            value={Array.isArray(value) ? (value as string[]) : []}
            onChange={onChange}
            placeholder="e.g. solarpunk, brutalist, monochrome..."
          />
        ),
      },
      {
        name: "aestheticNotes",
        label: "Notes on look and feel (optional)",
        input: "textarea",
        placeholder: "Free-form — references, mood, textures, anti-references.",
      },
    ],
  },
  {
    id: "needs",
    label: "Where we can help",
    description:
      "The collective is just probing for where it could be useful. None of these have to apply — you can leave everything blank.",
    optional: true,
    fields: [
      {
        name: "needs",
        label: "Are you looking for...?",
        input: "multichoice",
        options: opts(NEED_VALUES, NEED_LABELS),
      },
      {
        name: "needsNote",
        label: "Anything specific? (optional)",
        input: "textarea",
        placeholder: "A line or two about the gap, if you can name it.",
        hint: "Helps us prioritize what to build next.",
      },
    ],
  },
  {
    id: "features",
    label: "Features",
    description:
      "Pick anything you'd want from the start. Availability varies, but this shapes what the team sets up for you first.",
    optional: true,
    fields: [
      {
        name: "featuresRequested",
        label: "Features",
        input: "multichoice",
        options: opts(FEATURE_VALUES, FEATURE_LABELS),
      },
      {
        name: "featuresOther",
        label: "Anything else? (optional)",
        input: "textarea",
        placeholder: "A custom feature, integration, or specific workflow you need...",
        hint: "No guarantees, but if it's a common-enough ask we may build it.",
      },
    ],
  },
  {
    id: "template",
    label: "Template",
    description:
      "This is a preliminary pick — it shapes the first pass of your page. The dedicated Web Design step (coming soon) is where real layout and styling happens. Nothing is locked in.",
    fields: [
      {
        name: "templatePreference",
        label: "Archetype",
        input: "radio",
        required: true,
        options: TEMPLATE_VALUES.map((value) => ({
          value,
          label: `${TEMPLATE_LABELS[value].title} — ${TEMPLATE_LABELS[value].blurb}`,
        })),
      },
      {
        name: "palettePreference",
        label: "Palette / vibe (optional)",
        input: "text",
        placeholder: "e.g. warm earthy, high-contrast b&w, sun-faded pastels",
        hint: "Free-form — the team uses this as a starting brief.",
      },
    ],
  },
];

/** Which step label owns each answer key, for naming what the final check rejected. */
const STEP_OF_FIELD: Record<string, string> = Object.fromEntries(
  STEPS.flatMap((s) => s.fields.map((f) => [f.name, s.label ?? s.id]))
);

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export function ArtistProfileWizard({
  storageKey,
  initialAnswers,
  serverUpdatedAt,
  editing,
}: Props) {
  const router = useRouter();

  return (
    <TemplateWizard<Partial<WizardAnswers>>
      storageKey={storageKey}
      steps={STEPS}
      initialAnswers={initialAnswers}
      serverUpdatedAt={serverUpdatedAt}
      finishLabel={editing ? "Save profile" : "Finish profile"}
      onSave={async (answers) => {
        await postJson("/api/wizard/save", answers);
      }}
      onExit={() => router.push("/hub")}
      onFinish={async (answers) => {
        const parsed = wizardSchema.safeParse(answers);
        if (!parsed.success) {
          // Name the steps, not the fields: the chips are how the artist gets
          // back to them, and a step with an empty required field is already
          // marked there.
          const steps = Array.from(
            new Set(
              parsed.error.issues.map((i) => STEP_OF_FIELD[String(i.path[0])] ?? String(i.path[0]))
            )
          );
          const detail = parsed.error.issues
            .map((i) => `${String(i.path[0])}: ${i.message}`)
            .join(" · ");
          toast.error(`Some answers need attention in: ${steps.join(", ")}`, {
            description: detail,
          });
          return;
        }
        try {
          await postJson("/api/wizard/submit", parsed.data);
          toast.success(editing ? "Profile saved" : "Profile complete");
          router.push(editing ? "/wizard/confirm" : "/hub");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save your profile");
        }
      }}
    />
  );
}
