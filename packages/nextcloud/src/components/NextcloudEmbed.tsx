/**
 * Nextcloud App Embed Component
 * Generic iframe wrapper for embedding Nextcloud apps with authentication
 */

'use client';

import React, { useEffect, useState } from 'react';

export interface NextcloudEmbedProps {
  /** Nextcloud base URL (e.g., 'http://192.168.2.26:8080') */
  baseUrl: string;
  /** Nextcloud app path (e.g., '/apps/polls', '/apps/calendar') */
  appPath: string;
  /** Additional URL parameters */
  params?: Record<string, string>;
  /** Title for accessibility */
  title: string;
  /** Container className for styling */
  className?: string;
  /** Iframe className for styling */
  iframeClassName?: string;
  /** Height of the iframe */
  height?: string | number;
  /** Whether to allow fullscreen */
  allowFullscreen?: boolean;
  /** Callback when iframe loads */
  onLoad?: () => void;
  /** Callback when iframe fails to load */
  onError?: (error: Error) => void;
}

/**
 * Embed a Nextcloud app in an iframe
 *
 * Requirements:
 * - User must be authenticated in Nextcloud (session cookie)
 * - Nextcloud must have proper CORS/CSP headers for iframe embedding
 * - X-Frame-Options must allow same-origin or be removed
 *
 * Usage:
 * ```tsx
 * <NextcloudEmbed
 *   appPath="/apps/polls"
 *   title="Polls"
 *   height="600px"
 * />
 * ```
 */
export function NextcloudEmbed({
  baseUrl,
  appPath,
  params = {},
  title,
  className = '',
  iframeClassName = '',
  height = '600px',
  allowFullscreen = false,
  onLoad,
  onError,
}: NextcloudEmbedProps) {
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Build iframe URL with params
    if (!baseUrl) {
      setError('Nextcloud URL not configured');
      onError?.(new Error('Nextcloud baseUrl prop is required'));
      return;
    }

    const url = new URL(appPath, baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    setIframeSrc(url.toString());
  }, [baseUrl, appPath, params, onError]);

  const handleLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    const err = new Error(`Failed to load Nextcloud app: ${appPath}`);
    setError(err.message);
    setLoading(false);
    onError?.(err);
  };

  if (error) {
    return (
      <div className={`rounded-lg border border-destructive bg-destructive/10 p-6 ${className}`}>
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-destructive mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-destructive">Unable to load {title}</h3>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading {title}...</p>
          </div>
        </div>
      )}
      <iframe
        src={iframeSrc}
        title={title}
        className={`w-full border-0 rounded-lg ${iframeClassName}`}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
        allow="fullscreen; camera; microphone"
        allowFullScreen={allowFullscreen}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
