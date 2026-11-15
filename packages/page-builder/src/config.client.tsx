"use client";

import { createElement, Fragment } from "react";
import { AutoField, type Config } from "@puckeditor/core";
import type { PropDef } from "@elkdonis/blocks";
import type { Block } from "@elkdonis/blocks";
import { buildPuckConfig, type PuckConfigOptions } from "./config";
import { ImageField, type MediaSources } from "./fields/image-field";
import { SizeField } from "./fields/size-field";
import { ColorField } from "./fields/color-field";
import { CanvasDrag } from "./drag/canvas-drag";
import { EmptyBlock } from "./drag/empty-block";
import { StyleField } from "./style/field";

// ============================================================================
// The catalogue as the EDITOR sees it.
//
// The only difference from the published config is the field panel: an image
// prop becomes a media picker, and a number prop that declared a range becomes
// a slider. Both are React components from Puck's world, which is why this is
// a separate module — a published page renders no panel, and the server config
// must not pull an editor component into its graph.
// ============================================================================

export interface EditorConfigOptions extends PuckConfigOptions {
  /** Where this site's pictures are uploaded to and chosen from. */
  media: MediaSources;
}

/**
 * What a row's rich text may hold (2026-11-14, generalised from sunjay's Numbered steps fix by system32-fc): the
 * top-level set (what `sanitizePageText` keeps) with row-sized headings. Code, rules and alignment are off.
 */
const ROW_RICH_TEXT = { code: false, codeBlock: false, horizontalRule: false, textAlign: false, heading: { levels: [3, 4] } };

/**
 * A rich-text COLUMN of a rows prop as Puck's own formatted-text field, instead of a textarea showing the stored HTML
 * (`<p>…</p>`). A custom field, not `type: "richtext"` in `arrayFields`: Puck's canvas swaps a richtext field's value
 * for its own element, which a block reading the row's HTML could not draw. The stored value stays the same HTML
 * string, and saving still goes through the host's sanitiser.
 */
function rowRichText(prop: PropDef) {
  return function RowRichText(props: Record<string, unknown>) {
    // No `id` or `name`: AutoField keeps the value in a store keyed by its own id, and the rich-text field reads it
    // back by name (default: that id). The outer field's name ("steps[0].text") is not a key of that store, so
    // passing it drew an empty editor (sunjay harness/event-detail/drive-steps.cjs).
    return createElement(AutoField as never, {
      field: { type: "richtext", label: prop.label, options: ROW_RICH_TEXT },
      value: typeof props.value === "string" ? props.value : "",
      onChange: props.onChange,
      readOnly: props.readOnly,
    });
  };
}

/** A field that draws nothing: for a prop this site cannot fill (an unclaimed Opens). */
function NoField(): React.ReactElement {
  return createElement(Fragment);
}

export function buildEditorConfig({ media, ...options }: EditorConfigOptions): Config {
  return buildPuckConfig({
    ...options,
    // Text blocks are typed on the page, formatted. Editor only — see the
    // note on `richText` in ./config.
    richText: options.richText ?? true,
    // A row's rich-text column gets the same formatted field (a host's own `fields.richtext` wins).
    rowFields: { richtext: rowRichText, ...options.rowFields },
    // The generic "Style" control, at the foot of every block's fields.
    styleField:
      options.styleField ??
      (function BlockStyleControl(props: Record<string, unknown>) {
        return createElement(StyleField, props as never);
      }),
    // Blocks that declare `manipulate` get handles on the canvas — the image
    // is picked up and moved rather than positioned from a dropdown. Blocks
    // that declare nothing are passed through untouched and cost nothing.
    //
    // Every block also gets EmptyBlock: one that draws nothing (a banner with
    // no heading yet — which is every block, the moment it is dropped) shows
    // a card saying what it is instead of an invisible, unclickable gap.
    decorate:
      options.decorate ??
      ((block: Block<never>, Component) =>
        function Manipulable(props: Record<string, unknown>) {
          const puck = props.puck as { isEditing?: boolean } | undefined;
          const drawn = createElement(
            CanvasDrag,
            {
              id: props.id as string,
              def: block.def,
              isEditing: puck?.isEditing,
            },
            createElement(Component as never, props as never)
          );
          return puck?.isEditing
            ? createElement(EmptyBlock, { id: props.id as string, block }, drawn)
            : drawn;
        } as never),
    fields: {
      image: (prop: PropDef) =>
        function ImageProp(props: Record<string, unknown>) {
          return createElement(ImageField, {
            ...(props as object),
            hint: prop.description,
            field: { label: prop.label },
            media,
          } as never);
        },

      // A number is only offered as a slider when the block declared a range.
      // Without one there is nothing to drag between, and "how many posts" is
      // a value you know rather than one you judge — so `null` hands those
      // back to Puck's own number field instead of replacing it.
      number: (prop: PropDef) =>
        prop.min === undefined || prop.max === undefined
          ? null
          : function SizeProp(props: Record<string, unknown>) {
              return createElement(SizeField, {
                ...(props as object),
                hint: prop.description,
                field: { label: prop.label },
                min: prop.min,
                max: prop.max,
                step: prop.step ?? 1,
                unit: prop.unit,
              } as never);
            },

      ...options.fields,

      // A site may claim strings for its own pickers (Dana's `binds`). What it
      // hands back as null still gets a colour control when the prop is one,
      // so a site's override never costs it the shared ones.
      // An Opens (`binds: "opens"`, 2026-11-06) needs the site's chooser and resolver: a site that has
      // not claimed it gets no field, rather than a box holding a reference nobody can write by hand.
      string: (prop: PropDef) =>
        options.fields?.string?.(prop) ??
        (prop.binds === "opens"
          ? NoField
          : prop.format === "color"
            ? function ColorProp(props: Record<string, unknown>) {
                return createElement(ColorField, {
                  ...(props as object),
                  hint: prop.description,
                  field: { label: prop.label },
                } as never);
              }
            : null),
    },
  });
}
