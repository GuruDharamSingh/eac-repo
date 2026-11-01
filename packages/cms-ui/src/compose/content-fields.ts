import * as React from "react";
import type { WizardFieldSpec } from "../wizard/fields";
import { DEFAULT_SERIES_DISPLAY_ZONES, SERIES_ZONE_CHOICES } from "./series-card";

// ============================================================================
// What a piece of content HAS, declared once.
//
// Four hand-written forms describe the same thing today — arts-collective's
// create-content-dialog (696 lines), inner-gathering's create-content-form
// (753), amrit-canada's content-form (488, a fork of the first) and
// hidden-enneagram's (429, a fork of the fork). They drift independently.
//
// This is the same move `field-registry.ts` made for workshops, applied to
// content in general: the field list becomes data, so a kind is a filter over
// groups rather than a new form. It is also what lets one CMS open the right
// shape for whatever is being made — the sheet reads this, it does not know
// what a "meeting" is.
//
// GROUPS ARE THE DISCLOSURE. A form that shows every field at once is a form
// people abandon. Each group says whether it is `optional`: optional groups
// render collapsed, with a one-line blurb of what is inside, and open
// themselves when they already hold a value (editing something that repeats
// opens "Repeats"). The fast things — a title, the body, when and where, who
// may come — stay open. Within a group, `dependsOn` hides the fields a switch
// unlocks: turning on RSVPs reveals the limit and the deadline; choosing a
// repeat reveals "until".
//
// Rich widgets stay with the host app. A body editor and a media picker need
// app-local dependencies (Tiptap, Nextcloud), so they are declared here as
// `custom` and supplied through `slots`.
// ============================================================================

/**
 * The vocabulary, deliberately small.
 *
 * `event` and `meeting` are the same shape and always were: arts-collective
 * calls it "event", inner-gathering and amrit-canada call it "meeting". Both
 * are listed so existing callers keep working, and both resolve to the same
 * groups — which is the argument for settling on one name rather than
 * translating between them forever.
 */
export type ContentKind = "post" | "event" | "meeting" | "series" | "workshop" | "service" | "product";

/**
 * A field, plus whether it belongs to the QUICK tier.
 *
 * Two tiers, one list: "quick" is what a calendar day's "+ add" asks for —
 * a title, a time, a place, a page — and "full" is everything. The same
 * field spec serves both; the tier is a filter over it, so the quick form
 * cannot drift from the full one. A field not marked `quick` is full-only.
 */
export type ContentFieldSpec = WizardFieldSpec & { quick?: boolean };

export type ContentTier = "quick" | "full";

export interface ContentFieldGroup {
  id: string;
  /** Section heading in the composer. Null renders the fields unlabelled. */
  label: string | null;
  /** Collapsed until opened, or until one of its fields holds a value. */
  optional?: boolean;
  /** One line under a collapsed group's name: what is in there. */
  blurb?: string;
  fields: ContentFieldSpec[];
}

export interface ContentFieldContext {
  /**
   * The org's feeds. When it has any, filing is REQUIRED — "which of my pages
   * does this go on" is the question amrit-canada added and arts-collective
   * never had, and content with nowhere to land is why an org publishes an
   * article and its own subdomain 404s the link.
   */
  feeds?: Array<{ slug: string; name: string }>;
  /** Offer "create a collaborative document" — needs Nextcloud wired. */
  canCreateDocument?: boolean;
  /** Offer "create a Talk room" — needs Nextcloud Talk wired. */
  canCreateTalkRoom?: boolean;
  /** Offer network cross-posting. Off for single-org sites. */
  canShareToNetwork?: boolean;
  /** The zone times are entered in, when the org is one physical room. */
  defaultTimeZone?: string;
  /**
   * The people who can host a gathering here. Given any, a dated kind gets a
   * "Who's hosting" choice, which the host saves onto the rota for the NEXT
   * occurrence (services' assignMeetingRole) — the same row Plan ahead
   * edits, so the form and the rota can never disagree about who it is.
   */
  hostCandidates?: Array<{ userId: string; displayName: string }>;
}

const VISIBILITY: ContentFieldSpec = {
  name: "visibility",
  label: "Who can see it",
  input: "select",
  required: true,
  inline: true,
  options: [
    { value: "PUBLIC", label: "Anyone" },
    { value: "ORGANIZATION", label: "Members of this organisation" },
    { value: "INVITE_ONLY", label: "Invited people only" },
  ],
};

const FORMAT: ContentFieldSpec = {
  name: "format",
  label: "Format",
  input: "select",
  quick: true,
  inline: true,
  options: [
    { value: "online", label: "Online" },
    { value: "in_person", label: "In person" },
    { value: "hybrid", label: "Hybrid" },
  ],
};

/**
 * Kinds that happen at a time, and therefore carry schedule and attendance.
 * `series` is scheduled (its first session is `scheduled_at`) but has its own
 * field list: see `buildSeriesFields`.
 */
const SCHEDULED: ContentKind[] = ["event", "meeting", "series", "workshop"];
/** Kinds that carry a price. Which are *purchasable* is commerce's call. */
const PRICED: ContentKind[] = ["workshop", "service", "product"];

export function buildContentFields(
  kind: ContentKind,
  ctx: ContentFieldContext = {},
  options: { tier?: ContentTier } = {}
): ContentFieldGroup[] {
  if (kind === "series") return tiered(buildSeriesFields(ctx), options.tier);
  const groups: ContentFieldGroup[] = [];
  const isScheduled = SCHEDULED.includes(kind);

  // ── the thing itself ──
  groups.push({
    id: "identity",
    label: null,
    fields: [
      {
        name: "title",
        label: "Title",
        input: "text",
        required: true,
        quick: true,
        placeholder:
          kind === "post"
            ? "What are you writing about?"
            : kind === "service"
              ? "What are you offering?"
              : "What is happening?",
      },
      // The body is `custom`: every app has its own rich-text editor, and
      // cms-ui carries none.
      { name: "body", label: kind === "post" ? "Body" : "Description", input: "custom" },
    ],
  });

  groups.push({
    id: "summary",
    label: "Summary",
    optional: true,
    blurb: "One or two lines for listings. Left empty, it is taken from the body.",
    fields: [
      {
        name: "excerpt",
        label: "Summary",
        input: "textarea",
        placeholder: "The line under the title in a list.",
      },
    ],
  });

  // ── when and where ──
  if (isScheduled) {
    groups.push({
      id: "schedule",
      label: "When and where",
      fields: [
        {
          name: "scheduled_at",
          label: "Starts",
          input: "datetime",
          required: true,
          quick: true,
          inline: true,
        },
        {
          name: "time_zone",
          label: "Time zone",
          input: "timezone",
          inline: true,
          hint: ctx.defaultTimeZone ? undefined : "Times are read in this zone.",
        },
        {
          name: "duration_minutes",
          label: "How long",
          input: "duration",
          quick: true,
        },
        { name: "location", label: "Where", input: "text", quick: true, inline: true, placeholder: "An address, a room, or a link" },
        // Recurrence is part of what a gathering IS — the standing weekly
        // meeting, the monthly sadhana — so the PATTERN stays in the open
        // group. Its refinements (when it stops, an irregular rule) do not:
        // they are answers to a question most gatherings never raise, and
        // they moved to the drawer below.
        {
          name: "recurrence_pattern",
          label: "Repeats",
          input: "select",
          inline: true,
          placeholder: "Does not repeat",
          options: [
            { value: "DAILY", label: "Daily" },
            { value: "WEEKLY", label: "Weekly" },
            { value: "MONTHLY", label: "Monthly" },
          ],
        },
      ],
    });

    // ── the drawer ──
    // Six fields were visible before anyone had typed a title. Four of them
    // answer questions most gatherings never raise: nearly everything here is
    // online, nearly nothing has an end date, and an irregular schedule is
    // rare enough that a field for it was pure tax on the common case. They
    // are all still one click away, and `eac-group--optional` opens itself
    // when any of them already holds a value — so editing a gathering that
    // DOES use them shows them without being asked.
    groups.push({
      id: "gathering-detail",
      label: "More about this gathering",
      blurb: "Format, an end date, an irregular schedule",
      optional: true,
      fields: [
        FORMAT,
        {
          name: "recurrence_until",
          label: "Repeats until",
          input: "date",
          inline: true,
          placeholder: "No end date",
          dependsOn: { field: "recurrence_pattern", not: "NONE" },
        },
        {
          name: "recurrence_custom_rule",
          label: "Or an irregular schedule",
          input: "text",
          placeholder: "First Tuesday of the month, term time only…",
          hint:
            "Written for people to read, not parsed — the calendar still uses the pattern above.",
        },
      ],
    });

    // Who is running it. Only where the host said who could: a site with no
    // rota has no candidates, and a picker of nobody is worse than none.
    if (ctx.hostCandidates && ctx.hostCandidates.length > 0) {
      groups.push({
        id: "hosting",
        label: "Who's hosting",
        blurb: "For the next time it happens — later weeks are set in Plan ahead",
        fields: [
          {
            name: "host_user_id",
            label: "Host",
            input: "select",
            inline: true,
            // The control's own empty option carries this label — adding a
            // "" option as well showed two ways of saying nobody.
            placeholder: "Nobody yet",
            options: ctx.hostCandidates.map((c) => ({ value: c.userId, label: c.displayName })),
          },
          {
            name: "co_host_user_id",
            label: "Co-host",
            input: "select",
            inline: true,
            placeholder: "Nobody",
            options: ctx.hostCandidates.map((c) => ({ value: c.userId, label: c.displayName })),
          },
        ],
      });
    }

    // The toggle is the disclosure: switching RSVPs on reveals the rest.
    groups.push({
      id: "attendance",
      label: "Attendance",
      fields: [
        {
          name: "is_rsvp_enabled",
          label: "Take RSVPs",
          input: "toggle",
          placeholder: "people can say they are coming",
        },
        {
          name: "attendee_limit",
          label: "Limit",
          input: "number",
          min: 1,
          inline: true,
          placeholder: "No cap",
          dependsOn: { field: "is_rsvp_enabled" },
        },
        {
          name: "rsvp_deadline",
          label: "RSVPs close",
          input: "datetime",
          inline: true,
          placeholder: "Open until it starts",
          dependsOn: { field: "is_rsvp_enabled" },
        },
        {
          name: "min_attendees",
          label: "Needs at least",
          input: "number",
          min: 1,
          inline: true,
          placeholder: "—",
          hint: "Below this, the gathering may not go ahead.",
          dependsOn: { field: "is_rsvp_enabled" },
        },
        {
          name: "notify_on_min_attendees",
          label: "Tell me when the minimum is reached",
          input: "toggle",
          dependsOn: { field: "min_attendees" },
        },
      ],
    });
  }

  if (kind === "workshop") {
    groups.push({
      id: "presentation",
      label: "Presentation",
      fields: [
        { name: "subtitle", label: "Subtitle", input: "text", inline: true, placeholder: "One line under the title" },
        { name: "discipline", label: "Discipline", input: "text", inline: true, placeholder: "Writing, movement, sound…" },
        {
          name: "level",
          label: "Level",
          input: "select",
          inline: true,
          placeholder: "Any",
          options: [
            { value: "all_levels", label: "All levels" },
            { value: "beginner", label: "Beginner" },
            { value: "intermediate", label: "Intermediate" },
            { value: "advanced", label: "Advanced" },
          ],
        },
        {
          name: "banner_image_url",
          label: "Banner",
          input: "custom",
          slot: "media",
          hint: "Full width across the top of the page. This one is cropped, so choose where it crops below.",
        },
        {
          name: "banner_focal_y",
          label: "Where the banner keeps its subject",
          input: "focal",
          previewField: "banner_image_url",
          dependsOn: { field: "banner_image_url" },
        },
        {
          name: "hero_media_url",
          label: "Hero image",
          input: "custom",
          slot: "media",
          hint: "Shown whole under the details, never cropped. The cover image (below) is what listings show.",
        },
        { name: "hero_text", label: "Words over the hero", input: "text", placeholder: "Optional", dependsOn: { field: "hero_media_url" } },
        { name: "background_color", label: "Page colour", input: "color", hint: "The page's own background. Leave black to use the site's." },
      ],
    });

    groups.push({
      id: "sessions",
      label: "Sessions",
      fields: [
        {
          name: "sessions",
          label: "Sessions",
          input: "sessions",
          hint: "Each session can carry its own image and colour, so a series reads as chapters.",
        },
      ],
    });
  }

  // ── a service: how it is booked ──
  // A service is not scheduled (someone books it and a time is agreed), so it
  // has none of the "When and where" group. What it has instead is the shape
  // of the booking. Answer keys are the ones service-offerings.ts reads
  // (serviceInputFromAnswers), so every host saves them the same way.
  if (kind === "service") {
    groups.push({
      id: "booking",
      label: "The booking",
      fields: [
        {
          name: "booking_type",
          label: "Who it is for",
          input: "select",
          required: true,
          inline: true,
          options: [
            { value: "one_on_one", label: "One person" },
            { value: "group", label: "A group" },
            { value: "async", label: "Self-paced, no meeting" },
          ],
        },
        FORMAT,
        {
          name: "session_duration_hrs",
          label: "Length (hours)",
          input: "number",
          min: 0,
          step: "any",
          inline: true,
          placeholder: "1",
        },
        {
          name: "session_count",
          label: "Sessions",
          input: "number",
          min: 1,
          inline: true,
          placeholder: "1",
        },
        {
          name: "location",
          label: "Where",
          input: "text",
          inline: true,
          placeholder: "An address, or leave empty for online",
          dependsOn: { field: "format", not: "online" },
        },
        {
          name: "recurrence_label",
          label: "How often",
          input: "text",
          placeholder: "Weekly, by arrangement, once…",
        },
        { name: "subtitle", label: "Subtitle", input: "text", placeholder: "One line under the title" },
      ],
    });
  }

  if (PRICED.includes(kind)) {
    const pricing: ContentFieldSpec[] = [
      { name: "price", label: "Price", input: "number", min: 0, step: "any", placeholder: "0", quick: true, inline: true },
      { name: "currency", label: "Currency", input: "text", placeholder: kind === "service" ? "CAD" : "USD", inline: true },
    ];
    if (kind === "service") {
      pricing.push(
        {
          name: "sliding_scale",
          label: "Sliding scale",
          input: "toggle",
          placeholder: "people choose what they pay, down to a floor",
        },
        {
          name: "price_sliding_min",
          label: "Lowest amount",
          input: "number",
          min: 0,
          step: "any",
          inline: true,
          dependsOn: { field: "sliding_scale" },
        },
        {
          name: "sliding_scale_note",
          label: "A note about the scale",
          input: "text",
          placeholder: "Pay what you can; the full price supports someone else",
          dependsOn: { field: "sliding_scale" },
        },
        {
          name: "registration_status",
          label: "Booking is",
          input: "select",
          required: true,
          inline: true,
          options: [
            { value: "open", label: "Open" },
            { value: "waitlist", label: "Waitlist only" },
            { value: "full", label: "Full" },
            { value: "closed", label: "Closed" },
          ],
          hint: "Only an open service can be booked and paid for.",
        },
      );
    }
    groups.push({ id: "pricing", label: "Price", fields: pricing });
  }

  // ── links and rooms ──
  const integrations: ContentFieldSpec[] = [];
  if (isScheduled) {
    integrations.push({
      name: "meeting_url",
      label: "Joining link",
      input: "url",
      inline: true,
      placeholder: "https:// — Zoom, Meet, Jitsi…",
    });
    if (ctx.canCreateTalkRoom) {
      integrations.push({
        name: "create_talk_room",
        label: "Or make a Talk room",
        input: "toggle",
        inline: true,
        placeholder: "a public room, joinable by link, no account needed",
        dependsOn: { field: "meeting_url", equals: "" },
      });
    }
    integrations.push({
      name: "video_link",
      label: "Recording",
      input: "url",
      placeholder: "https:// — added afterwards, usually",
    });
  }
  if (ctx.canCreateDocument) {
    integrations.push({
      name: "create_document",
      label: "Collaborative document",
      input: "toggle",
      placeholder: "a markdown file in Nextcloud you and your members can edit together",
    });
  }
  if (integrations.length) {
    groups.push({
      id: "integrations",
      label: isScheduled ? "Links and rooms" : "Workspace",
      optional: true,
      blurb: isScheduled
        ? "A joining link or a public Talk room, the recording, a shared document."
        : "A shared document in Nextcloud.",
      fields: integrations,
    });
  }

  // ── media ──
  // Media is a pane, not a field — see ContentComposer. The answer key is the
  // column the host writes, so a slot's value lands somewhere real.
  groups.push({
    id: "media",
    label: "Cover image",
    optional: true,
    blurb: "Shown in listings and at the top of the page.",
    fields: [
      {
        name: "cover_image_url",
        label: "Cover image",
        input: "custom",
        slot: "media",
        hint: "Shown in listings and at the top of the page.",
      },
    ],
  });

  // ── where it goes ──
  const placement: ContentFieldSpec[] = [];
  if (ctx.feeds?.length) {
    placement.push({
      name: "feed_slug",
      label: "Publish to",
      input: "select",
      required: true,
      quick: true,
      inline: true,
      options: ctx.feeds.map((f) => ({ value: f.slug, label: f.name })),
    });
  }
  placement.push(VISIBILITY);
  if (ctx.canShareToNetwork) {
    placement.push({
      name: "share_to_network",
      label: "Share to the network",
      input: "toggle",
      placeholder: "also show this on the collective's front page",
    });
  }
  groups.push(placementGroup(ctx));

  return tiered(groups, options.tier);
}

function tiered(groups: ContentFieldGroup[], tier: ContentTier | undefined): ContentFieldGroup[] {
  if (tier !== "quick") return groups;
  return groups
    .map((g) => ({ ...g, optional: false, fields: g.fields.filter((f) => f.quick) }))
    .filter((g) => g.fields.length > 0);
}

function placementGroup(ctx: ContentFieldContext): ContentFieldGroup {
  const placement: ContentFieldSpec[] = [];
  if (ctx.feeds?.length) {
    placement.push({
      name: "feed_slug",
      label: "Publish to",
      input: "select",
      required: true,
      quick: true,
      inline: true,
      options: ctx.feeds.map((f) => ({ value: f.slug, label: f.name })),
    });
  }
  placement.push(VISIBILITY);
  if (ctx.canShareToNetwork) {
    placement.push({
      name: "share_to_network",
      label: "Share to the network",
      input: "toggle",
      placeholder: "also show this on the collective's front page",
    });
  }
  return { id: "placement", label: "Where it goes", fields: placement };
}

/**
 * A meeting series (2026-10-10, docs/open/SERIES_KIND_DESIGN_2026-10-10.md §5).
 *
 * The series card: what is the same every week. Title, description (the
 * lede the series page prints under its title), cover, when it meets, how
 * to join, the zones its times are printed in and the subscriber letter.
 * No host fields: hosts are set per week in the planner. The repeat is
 * always weekly, so there is no "Repeats" field.
 *
 * `series_editing` is set by `defaultThreadToAnswers` for an existing series.
 * The schedule, joining and letter groups then give way to a note: weeks are
 * keyed by their dates, so the schedule changes only in the planner, and the
 * join details are not loaded into this form, so it must not show them empty.
 */
const NEW_SERIES_ONLY = { field: "series_editing", equals: false } as const;

function buildSeriesFields(ctx: ContentFieldContext): ContentFieldGroup[] {
  const groups: ContentFieldGroup[] = [];

  groups.push({
    id: "series-identity",
    label: null,
    fields: [
      { name: "title", label: "Series title", input: "text", required: true, quick: true, placeholder: "What the series is called" },
      {
        name: "lede",
        label: "Description",
        input: "textarea",
        placeholder: "What the series is about and who it is for.",
        hint: "Shown under the title on the series page and in listings.",
      },
    ],
  });

  groups.push({
    id: "series-schedule",
    label: "When it meets",
    fields: [
      {
        name: "scheduled_at",
        label: "First session",
        input: "datetime",
        required: true,
        quick: true,
        hint: "The series meets every week on this day, at this time.",
        dependsOn: NEW_SERIES_ONLY,
      },
      { name: "time_zone", label: "Time zone", input: "timezone", required: true, quick: true, inline: true, dependsOn: NEW_SERIES_ONLY },
      {
        name: "recurrence_until",
        label: "Last session",
        input: "date",
        inline: true,
        hint: "Leave empty for a series with no end date.",
        dependsOn: NEW_SERIES_ONLY,
      },
      { name: "duration_minutes", label: "How long", input: "duration", dependsOn: NEW_SERIES_ONLY },
      {
        name: "series_planner_note",
        label: "Schedule, joining and the reminder letter",
        input: "custom",
        render: () =>
          React.createElement(
            "p",
            { className: "eac-field-hint" },
            "These are changed in the series planner, where moving the schedule also moves the weeks already planned."
          ),
        dependsOn: { field: "series_editing", equals: true },
      },
    ],
  });

  const joining: ContentFieldSpec[] = [
    {
      name: "join_url",
      label: "Join link",
      input: "url",
      placeholder: "https:// — the same link every week",
      hint: "Sent in the weekly email and shown to people who have signed up. Not shown on the public page.",
      dependsOn: NEW_SERIES_ONLY,
    },
    { name: "join_meeting_id", label: "Meeting ID", input: "text", inline: true, placeholder: "000 0000 0000", dependsOn: { field: "join_url" } },
    { name: "join_passcode", label: "Passcode", input: "text", inline: true, dependsOn: { field: "join_url" } },
    {
      name: "join_other",
      label: "Other ways to join",
      input: "textarea",
      placeholder: "Dial-in numbers, one per line",
      dependsOn: { field: "join_url" },
    },
  ];
  if (ctx.canCreateTalkRoom) {
    joining.push({
      name: "create_talk_room",
      label: "Or make a Talk room",
      input: "toggle",
      placeholder: "a public room, joinable by link, no account needed",
      dependsOn: { field: "join_url", equals: "" },
    });
  }
  groups.push({ id: "series-joining", label: "Joining", fields: joining });

  groups.push({
    id: "series-display",
    label: "Times and reminders",
    fields: [
      {
        name: "also_zones",
        label: "Print times in",
        input: "multichoice",
        options: SERIES_ZONE_CHOICES,
        hint: "Each session's time is shown in these zones on the series page and in the emails.",
        dependsOn: NEW_SERIES_ONLY,
      },
      {
        name: "reminder_days",
        label: "Remind subscribers",
        input: "number",
        min: 0,
        max: 14,
        inline: true,
        hint: "Days before each published session; 0 sends no reminder.",
        dependsOn: NEW_SERIES_ONLY,
      },
    ],
  });

  groups.push({
    id: "media",
    label: "Cover image",
    fields: [
      {
        name: "cover_image_url",
        label: "Cover image",
        input: "custom",
        slot: "media",
        hint: "Shown at the top of the series page and on the home page. A week without its own cover uses this one.",
      },
    ],
  });

  groups.push(placementGroup(ctx));
  return groups;
}

/** Defaults for a fresh piece of content, matching the schemas' own defaults. */
export function emptyContentAnswers(
  kind: ContentKind,
  ctx: ContentFieldContext = {}
): Record<string, unknown> {
  return {
    kind,
    title: "",
    excerpt: "",
    body: "",
    visibility: "PUBLIC",
    share_to_network: false,
    feed_slug: ctx.feeds?.[0]?.slug ?? undefined,
    ...(SCHEDULED.includes(kind)
      ? {
          scheduled_at: "",
          time_zone: ctx.defaultTimeZone ?? "",
          duration_minutes: 60,
          format: "in_person",
          location: "",
          meeting_url: "",
          video_link: "",
          recurrence_pattern: "NONE",
          recurrence_until: "",
          is_rsvp_enabled: true,
          attendee_limit: undefined,
          rsvp_deadline: "",
          min_attendees: undefined,
          notify_on_min_attendees: false,
        }
      : {}),
    ...(PRICED.includes(kind) ? { price: undefined, currency: kind === "service" ? "CAD" : "USD" } : {}),
    ...(kind === "service"
      ? {
          booking_type: "one_on_one",
          format: "online",
          location: "",
          session_duration_hrs: undefined,
          session_count: undefined,
          recurrence_label: "",
          subtitle: "",
          sliding_scale: false,
          price_sliding_min: undefined,
          sliding_scale_note: "",
          registration_status: "open",
        }
      : {}),
    // A series: first session in `scheduled_at`, its zone required, weekly
    // always. The display zones default to the ones IFAC's series pages print
    // (Pacific, Eastern, Paris; `metadata.series.alsoZones`), and subscribers
    // are reminded two days ahead (services' DEFAULT_SUBSCRIBER_REMINDER_DAYS).
    ...(kind === "series"
      ? {
          lede: "",
          format: "online",
          recurrence_pattern: "WEEKLY",
          also_zones: [...DEFAULT_SERIES_DISPLAY_ZONES],
          join_url: "",
          join_meeting_id: "",
          join_passcode: "",
          join_other: "",
          reminder_days: 2,
          series_editing: false,
        }
      : {}),
    ...(kind === "workshop"
      ? {
          subtitle: "",
          discipline: "",
          level: "",
          banner_image_url: "",
          banner_focal_y: 50,
          hero_media_url: "",
          hero_text: "",
          background_color: "",
          sessions: [],
        }
      : {}),
    cover_image_url: "",
    create_document: false,
    create_talk_room: false,
  };
}

function filled(v: unknown): boolean {
  if (v === undefined || v === null || v === "" || v === false) return false;
  return !(Array.isArray(v) && v.length === 0);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Answers for `to`, carrying over what was typed under `from`.
 *
 * Starts from `to`'s defaults and keeps every answer that is filled in and
 * differs from `from`'s default (title, cover, first date, a chosen zone),
 * so switching "One meeting | Series" loses nothing typed and still gives
 * the new kind its own defaults for what was left alone. The description
 * moves between a meeting's rich `body` and a series' plain `lede`.
 */
export function switchContentKind(
  answers: Record<string, unknown>,
  from: ContentKind,
  to: ContentKind,
  ctx: ContentFieldContext = {}
): Record<string, unknown> {
  if (from === to) return answers;
  const fromDefaults = emptyContentAnswers(from, ctx);
  const next = emptyContentAnswers(to, ctx);
  for (const [key, value] of Object.entries(answers)) {
    if (key === "kind" || !filled(value) || sameValue(value, fromDefaults[key])) continue;
    next[key] = value;
  }
  // Each kind keeps its own repeat: a series is always weekly, a meeting
  // starts as "does not repeat".
  next.recurrence_pattern = emptyContentAnswers(to, ctx).recurrence_pattern;
  if (to === "series" && !filled(next.lede) && typeof answers.body === "string" && filled(answers.body)) {
    next.lede = plainText(answers.body).slice(0, 1000);
  }
  if (from === "series" && to !== "series" && !filled(next.body) && typeof answers.lede === "string" && filled(answers.lede)) {
    next.body = answers.lede
      .split(/\n{2,}/)
      .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }
  next.kind = to;
  return next;
}

/**
 * Whether a group already holds something other than its default — what
 * decides if an optional group opens on its own when editing.
 */
export function groupHasValues(
  group: ContentFieldGroup,
  answers: Record<string, unknown>,
  defaults: Record<string, unknown>
): boolean {
  return group.fields.some((f) => {
    const v = answers[f.name];
    if (v === undefined || v === null || v === "" || v === false) return false;
    return v !== defaults[f.name];
  });
}
