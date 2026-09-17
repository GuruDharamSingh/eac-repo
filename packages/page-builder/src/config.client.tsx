"use client";

import { createElement } from "react";
import type { Config } from "@puckeditor/core";
import type { PropDef } from "@elkdonis/blocks";
import type { Block } from "@elkdonis/blocks";
import { buildPuckConfig, type PuckConfigOptions } from "./config";
import { ImageField, type MediaSources } from "./fields/image-field";
import { SizeField } from "./fields/size-field";
import { CanvasDrag } from "./drag/canvas-drag";

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

export function buildEditorConfig({ media, ...options }: EditorConfigOptions): Config {
  return buildPuckConfig({
    ...options,
    // Blocks that declare `manipulate` get handles on the canvas — the image
    // is picked up and moved rather than positioned from a dropdown. Blocks
    // that declare nothing are passed through untouched and cost nothing.
    decorate:
      options.decorate ??
      ((block: Block<never>, Component) =>
        function Manipulable(props: Record<string, unknown>) {
          const puck = props.puck as { isEditing?: boolean } | undefined;
          return createElement(
            CanvasDrag,
            {
              id: props.id as string,
              def: block.def,
              isEditing: puck?.isEditing,
            },
            createElement(Component as never, props as never)
          );
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
    },
  });
}
