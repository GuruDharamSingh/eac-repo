'use client';

// Filerobot Image Editor (MIT, react-filerobot-image-editor 5.0 beta, React 19)
// inside the Studio's ImageEditor. Loaded on demand and in the browser only
// (next/dynamic with ssr: false in ImageEditor.tsx), so its ~280 KB compressed stays out of every other page.
// Verified 2026-11-01 in headless Chrome with a 6000x4000 JPEG: all tabs,
// filters, save 1.3 s. Known beta fault: opening on the Filters tab before
// the picture has loaded throws, so it opens on Adjust.

import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import type { ImageEditorSaved } from './ImageEditor';

/** Crop shapes the platforms use, plus free. */
const PRESETS = [
  { titleKey: 'Instagram portrait', descriptionKey: '4:5', ratio: 4 / 5 },
  { titleKey: 'Square', descriptionKey: '1:1', ratio: 1 },
  { titleKey: 'Story or reel', descriptionKey: '9:16', ratio: 9 / 16 },
  { titleKey: 'Landscape', descriptionKey: '16:9', ratio: 16 / 9 },
  { titleKey: 'Link preview', descriptionKey: '1.91:1', ratio: 1.91 },
];

export default function FilerobotView({
  src,
  name,
  onSave,
  onClose,
}: {
  src: string;
  name: string;
  onSave(saved: ImageEditorSaved): void;
  onClose(): void;
}) {
  return (
    <FilerobotImageEditor
      source={src}
      defaultSavedImageName={name}
      defaultSavedImageType="jpeg"
      defaultSavedImageQuality={0.9}
      savingPixelRatio={1}
      previewPixelRatio={typeof window === 'undefined' ? 1 : window.devicePixelRatio}
      tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.FILTERS, TABS.RESIZE, TABS.ANNOTATE, TABS.WATERMARK]}
      defaultTabId={TABS.ADJUST}
      defaultToolId={TOOLS.CROP}
      Crop={{ presetsItems: PRESETS }}
      Text={{ text: 'Your text', fontFamily: 'Arial', fonts: [{ label: 'Sans', value: 'Arial' }, { label: 'Serif', value: 'Georgia' }, { label: 'Typewriter', value: 'Courier New' }] }}
      closeAfterSave
      onClose={onClose}
      // Save straight away (no name/format dialog): the host decides where it goes.
      onBeforeSave={() => false}
      onSave={(img) => {
        if (img.imageBase64) onSave({ dataUrl: img.imageBase64, mimeType: img.mimeType ?? 'image/jpeg', width: img.width ?? 0, height: img.height ?? 0 });
      }}
    />
  );
}
