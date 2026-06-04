/**
 * @elkdonis/studio-ui
 *
 * Framework-neutral (non-Mantine) authoring components for content publishing
 * surfaces across the monorepo. Pure Radix-free Tailwind + Tiptap, designed to
 * drop into any shadcn-styled app (art-auction studio, future creator tools).
 *
 * Components are headless about persistence — they take controlled values and
 * callbacks, never importing app-specific server actions.
 */

export { RichTextEditor, type RichTextEditorProps } from "./rich-text-editor";
export {
  MultiImageUploader,
  type MultiImageUploaderProps,
  type UploadedImage,
} from "./multi-image-uploader";
export { cn } from "./cn";
