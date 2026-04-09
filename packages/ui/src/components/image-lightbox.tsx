'use client';

import { Modal } from '@mantine/core';

export interface ImageLightboxProps {
  url: string | null;
  alt?: string;
  opened: boolean;
  onClose: () => void;
}

export function ImageLightbox({ url, alt, opened, onClose }: ImageLightboxProps) {
  if (!url) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton
      padding={0}
      styles={{
        body: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
        },
        header: {
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: 'transparent',
        },
        close: {
          color: 'white',
          width: 40,
          height: 40,
        },
      }}
    >
      <img
        src={url}
        alt={alt || 'Full size image'}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
        onClick={onClose}
      />
    </Modal>
  );
}
