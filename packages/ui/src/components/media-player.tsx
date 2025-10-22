'use client';

import { useState } from 'react';

export interface MediaPlayerProps {
  url: string;
  type: 'video' | 'audio' | 'image';
  title?: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  poster?: string;
}

/**
 * Universal media player component for videos, audio, and images
 * Works with the /api/media proxy route for authenticated Nextcloud access
 */
export function MediaPlayer({
  url,
  type,
  title,
  className = '',
  controls = true,
  autoPlay = false,
  poster,
}: MediaPlayerProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
  };

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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Failed to load {type}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className={`relative ${className}`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        )}
        <video
          className="w-full rounded-lg"
          controls={controls}
          autoPlay={autoPlay}
          poster={poster}
          onError={handleError}
          onLoadedData={handleLoad}
          playsInline
        >
          <source src={url} type="video/mp4" />
          <source src={url} type="video/webm" />
          <source src={url} type="video/ogg" />
          Your browser does not support the video tag.
        </video>
        {title && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{title}</p>
        )}
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <div className={`${className}`}>
        {loading && (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        )}
        <audio
          className="w-full"
          controls={controls}
          autoPlay={autoPlay}
          onError={handleError}
          onLoadedData={handleLoad}
        >
          <source src={url} type="audio/mpeg" />
          <source src={url} type="audio/ogg" />
          <source src={url} type="audio/wav" />
          Your browser does not support the audio tag.
        </audio>
        {title && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{title}</p>
        )}
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className={`relative ${className}`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        )}
        <img
          src={url}
          alt={title || 'Media'}
          className="w-full h-auto rounded-lg"
          onError={handleError}
          onLoad={handleLoad}
        />
        {title && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{title}</p>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Media gallery component for displaying multiple media items
 */
export interface MediaGalleryProps {
  items: Array<{
    id: string;
    url: string;
    type: 'video' | 'audio' | 'image';
    title?: string;
  }>;
  className?: string;
}

export function MediaGallery({ items, className = '' }: MediaGalleryProps) {
  if (items.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((item) => (
        <MediaPlayer
          key={item.id}
          url={item.url}
          type={item.type}
          title={item.title}
        />
      ))}
    </div>
  );
}
