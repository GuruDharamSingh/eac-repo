'use client';

import * as React from 'react';
import { useEditorUpload } from '../upload-context';

/** A file picker bound to the canvas's upload endpoint; `onDone` gets the served URL. */
export function useUpload(onDone: (src: string) => void) {
  const upload = useEditorUpload();
  const [uploading, setUploading] = React.useState(false);
  const pick = React.useCallback(() => {
    if (!upload) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setUploading(true);
      try {
        const src = await upload(f);
        if (src) onDone(src);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [upload, onDone]);
  return { pick, uploading, available: Boolean(upload) };
}
