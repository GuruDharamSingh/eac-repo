/**
 * TalkEmbed - Embed Nextcloud Talk video chat
 * 
 * Usage:
 * ```tsx
 * import { TalkEmbed } from '@elkdonis/nextcloud/components';
 * 
 * <TalkEmbed 
 *   roomToken={meeting.nextcloud_talk_token}
 *   height="600px"
 * />
 * ```
 */

'use client';

export interface TalkEmbedProps {
  roomToken: string;
  height?: string;
  width?: string;
  className?: string;
  allowCamera?: boolean;
  allowMicrophone?: boolean;
  allowScreenShare?: boolean;
}

export function TalkEmbed({
  roomToken,
  height = '600px',
  width = '100%',
  className = '',
  allowCamera = true,
  allowMicrophone = true,
  allowScreenShare = true,
}: TalkEmbedProps) {
  const nextcloudUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';
  const embedUrl = `${nextcloudUrl}/call/${roomToken}`;

  // Build permissions string
  const permissions: string[] = [];
  if (allowCamera) permissions.push('camera');
  if (allowMicrophone) permissions.push('microphone');
  if (allowScreenShare) permissions.push('display-capture');

  return (
    <iframe
      src={embedUrl}
      allow={permissions.join('; ')}
      style={{ width, height, border: 0 }}
      className={className}
      title="Nextcloud Talk Video Chat"
    />
  );
}
