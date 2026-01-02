'use client';

import { useCallback, useState } from 'react';
import { Anchor, Button, Loader, Text, Tooltip } from '@mantine/core';
import { Cloud, ExternalLink, AlertCircle } from 'lucide-react';

export interface NextcloudLinkProps {
  /** Target path in Nextcloud (e.g., /apps/files, /apps/talk/call/token) */
  target?: string;
  /** If true, forces re-authentication to ensure correct user */
  forceAuth?: boolean;
  /** Button or link style */
  variant?: 'button' | 'link' | 'icon';
  /** Button color (only for button variant) */
  color?: string;
  /** Children to render inside the link */
  children?: React.ReactNode;
  /** Custom label (overrides children) */
  label?: string;
  /** Size for button/link */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Admin app base URL */
  adminBaseUrl?: string;
  /** Nextcloud base URL (for direct links when user is known to be logged in) */
  nextcloudBaseUrl?: string;
  /** Show loading state while redirecting */
  showLoading?: boolean;
  /** Callback when user is not synced to Nextcloud */
  onNotSynced?: () => void;
  /** Use direct Nextcloud URL (skip admin redirect) */
  directLink?: boolean;
}

/**
 * NextcloudLink - Smart link component for Nextcloud resources
 *
 * Handles SSO by routing through the admin app's redirect endpoint,
 * which ensures the correct user is logged into Nextcloud.
 *
 * Usage:
 * ```tsx
 * <NextcloudLink target="/apps/files">Files</NextcloudLink>
 * <NextcloudLink target="/apps/talk" variant="button">Talk</NextcloudLink>
 * <NextcloudLink target={`/apps/talk/call/${talkToken}`} forceAuth>
 *   Join Meeting
 * </NextcloudLink>
 * ```
 */
export function NextcloudLink({
  target = '/',
  forceAuth = false,
  variant = 'link',
  color = 'blue',
  children,
  label,
  size = 'sm',
  adminBaseUrl = 'http://localhost:3000',
  nextcloudBaseUrl = 'http://localhost:8080',
  showLoading = true,
  onNotSynced,
  directLink = false,
}: NextcloudLinkProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);

    if (directLink) {
      // Direct link to Nextcloud (assumes user is already logged in correctly)
      window.open(`${nextcloudBaseUrl}${target}`, '_blank');
      return;
    }

    setLoading(true);

    try {
      // Build the redirect URL through admin app
      const redirectUrl = new URL('/api/nextcloud/redirect', adminBaseUrl);
      redirectUrl.searchParams.set('target', target);
      if (forceAuth) {
        redirectUrl.searchParams.set('force', 'true');
      }

      // Navigate to the redirect endpoint
      window.location.href = redirectUrl.toString();
    } catch (err: any) {
      setError(err.message || 'Failed to redirect');
      setLoading(false);
    }
  }, [target, forceAuth, adminBaseUrl, nextcloudBaseUrl, directLink]);

  const displayContent = label || children || (
    <>
      <Cloud size={14} style={{ marginRight: 4 }} />
      Nextcloud
    </>
  );

  if (variant === 'button') {
    return (
      <Tooltip label={error} disabled={!error} color="red">
        <Button
          onClick={handleClick}
          leftSection={loading && showLoading ? <Loader size={14} /> : undefined}
          rightSection={<ExternalLink size={14} />}
          color={error ? 'red' : color}
          size={size}
          disabled={loading}
        >
          {displayContent}
        </Button>
      </Tooltip>
    );
  }

  if (variant === 'icon') {
    return (
      <Tooltip label={error || 'Open in Nextcloud'} color={error ? 'red' : undefined}>
        <Button
          onClick={handleClick}
          variant="subtle"
          color={error ? 'red' : color}
          size={size}
          p={4}
          disabled={loading}
        >
          {loading && showLoading ? (
            <Loader size={14} />
          ) : error ? (
            <AlertCircle size={18} />
          ) : (
            <Cloud size={18} />
          )}
        </Button>
      </Tooltip>
    );
  }

  // Default: link variant
  return (
    <Anchor
      onClick={handleClick}
      size={size}
      c={error ? 'red' : undefined}
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {loading && showLoading && <Loader size={12} />}
      {displayContent}
      <ExternalLink size={12} />
    </Anchor>
  );
}
