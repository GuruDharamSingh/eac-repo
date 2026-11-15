'use client';

import * as React from 'react';

/** The canvas's upload, reachable from node views: a file in, a served URL out (null on failure). */
export type EditorUpload = (file: File) => Promise<string | null>;

export const UploadContext = React.createContext<EditorUpload | null>(null);

export function useEditorUpload(): EditorUpload | null {
  return React.useContext(UploadContext);
}
