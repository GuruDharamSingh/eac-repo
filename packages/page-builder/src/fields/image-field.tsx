"use client";

import { FieldLabel } from "@puckeditor/core";
import { MediaPicker } from "@elkdonis/cms-ui/files";

// ============================================================================
// An image prop, as a picker rather than a URL box.
//
// Every block that takes an image declares `kind: "image"`, and the adapter
// turned that into a plain text field with a comment admitting the compromise:
// "no dedicated image control without a custom field; plain text is the honest
// default rather than pretending there is a picker." This is the picker.
//
// A custom field is the ONLY route to a new control. Puck dispatches built-in
// fields through a closed table of eight types and calls into it unguarded, so
// inventing a `type: "image"` and supplying it through the `fieldTypes`
// override is a TypeError, not an extension point — the override is consulted
// on the line AFTER the crash.
//
// It lives here rather than in @elkdonis/blocks for the reason that package's
// header states: nothing in the block library imports an editor, so swapping
// the editor rewrites this adapter and not the blocks.
// ============================================================================

/**
 * Where a site's pictures come from.
 *
 * Per app, because the endpoints are: one site's upload route writes to the
 * artist's own folder, another's buckets by media type into the org's. The
 * picker is the same; the storage behind it is a property of the site.
 */
export interface MediaSources {
  uploadEndpoint: string;
  libraries?: { key: string; label: string; endpoint: string }[];
}

export interface ImageFieldProps {
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
  /** The prop's own description, threaded through as the picker's hint. */
  hint?: string;
  media: MediaSources;
}

export function ImageField({
  value,
  onChange,
  readOnly,
  field,
  hint,
  media,
}: ImageFieldProps) {
  const label = field?.label ?? "Image";

  // Puck applies no label to a custom field — it hands you the raw slot and
  // expects you to render FieldLabel yourself.
  //
  // `el="div"`: FieldLabel is a <label> by default, and a click anywhere in a
  // label is forwarded to its first control — here the Upload tab. So choosing
  // "Site images" flipped straight back to Upload, and the libraries looked
  // unreachable.
  return (
    <FieldLabel label={label} el="div">
      {readOnly ? (
        // A resolver owns this value, or the viewer may not edit. Show what is
        // set rather than a disabled picker that invites a click.
        <div style={{ fontSize: "0.8rem", opacity: 0.7, wordBreak: "break-all" }}>
          {value || "—"}
        </div>
      ) : (
        <MediaPicker
          value={value || undefined}
          onChange={onChange}
          uploadEndpoint={media.uploadEndpoint}
          libraries={media.libraries}
          label=""
          hint={hint}
        />
      )}
    </FieldLabel>
  );
}
