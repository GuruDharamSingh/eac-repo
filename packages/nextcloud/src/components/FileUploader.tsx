/**
 * FileUploader - Custom file upload UI using Nextcloud backend
 * 
 * Usage:
 * ```tsx
 * import { FileUploader } from '@elkdonis/nextcloud/components';
 * 
 * <FileUploader 
 *   orgPath="/Elkdonis/Sunjay"
 *   subfolder="meetings/abc123"
 *   onUploadComplete={(file) => console.log('Uploaded:', file)}
 * />
 * ```
 */

'use client';

import { useState } from 'react';

export interface FileUploaderProps {
  orgPath?: string;
  subfolder?: string;
  accept?: string;
  maxSize?: number; // in MB
  onUploadComplete?: (file: any) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export function FileUploader({
  orgPath,
  subfolder,
  accept,
  maxSize = 100, // 100MB default
  onUploadComplete,
  onError,
  className = '',
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      const errorMsg = `File size exceeds ${maxSize}MB limit`;
      setError(errorMsg);
      onError?.(new Error(errorMsg));
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      if (orgPath) formData.append('orgPath', orgPath);
      if (subfolder) formData.append('subfolder', subfolder);

      // Upload via your API route
      const response = await fetch('/api/nextcloud/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setProgress(100);
      onUploadComplete?.(result.file);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`file-uploader ${className}`}>
      <input
        type="file"
        onChange={handleFileSelect}
        accept={accept}
        disabled={uploading}
        className="file-input"
      />
      
      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>Uploading...</span>
        </div>
      )}
      
      {error && (
        <div className="upload-error">
          {error}
        </div>
      )}
    </div>
  );
}
