'use client';

import { useState } from 'react';

export interface DocumentViewerProps {
  shareToken?: string;
  documentUrl?: string;
  title?: string;
  className?: string;
  height?: string | number;
  mode?: 'view' | 'edit';
}

/**
 * Component to display Nextcloud collaborative documents in an iframe
 * Used for living documents attached to meetings
 * Supports real-time collaborative editing via Nextcloud Text app
 */
export function DocumentViewer({
  shareToken,
  documentUrl,
  title = 'Collaborative Document',
  className = '',
  height = '600px',
  mode = 'edit',
}: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  // Construct iframe URL
  // If shareToken provided, use Nextcloud public share URL for collaborative editing
  // Otherwise use the provided documentUrl
  let iframeUrl = documentUrl;
  
  if (shareToken && !documentUrl) {
    // Use Nextcloud Text app for collaborative editing
    // In client components, we can't access process.env at build time
    // So we'll use window.location.origin or a hardcoded URL
    const baseUrl = typeof window !== 'undefined' 
      ? (window.location.port === '3004' ? 'http://localhost:8080' : window.location.origin)
      : 'http://localhost:8080';
      
    if (mode === 'edit') {
      // Open Text editor for collaborative editing
      iframeUrl = `${baseUrl}/apps/text/s/${shareToken}`;
    } else {
      // Just view the shared document
      iframeUrl = `${baseUrl}/s/${shareToken}`;
    }
  }

  if (!iframeUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-8 ${className}`}>
        <div className="text-center">
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No document URL or share token provided
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-8 ${className}`}>
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Failed to load document
          </p>
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Open in new tab
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}>
      {loading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800"
          style={{ height }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      )}
      <iframe
        src={iframeUrl}
        title={title}
        className="w-full"
        style={{ height }}
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}

/**
 * Compact document link component for meeting cards
 */
export interface DocumentLinkProps {
  documentUrl: string;
  title?: string;
  className?: string;
}

export function DocumentLink({
  documentUrl,
  title = 'Living Document',
  className = '',
}: DocumentLinkProps) {
  return (
    <a
      href={documentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline ${className}`}
    >
      <span>{title}</span>
    </a>
  );
}
