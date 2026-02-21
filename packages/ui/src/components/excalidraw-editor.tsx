'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Paper,
  Stack,
  Title,
  Loader,
  Group,
  Text,
  ActionIcon,
  Tooltip,
  Portal,
} from '@mantine/core';
import { Maximize2, Minimize2 } from 'lucide-react';

/**
 * Excalidraw requires a fixed-height container to properly calculate canvas dimensions.
 * We keep it simple and let Excalidraw handle its internal canvas sizing.
 */

export interface ExcalidrawEditorProps {
  initialData?: Record<string, unknown> | null;
  onChange?: (data: Record<string, unknown>) => void;
  height?: number | string;
  readOnly?: boolean;
  label?: string;
}

export function ExcalidrawEditor({
  initialData,
  onChange,
  height = 500,
  readOnly = false,
  label = 'Drawing',
}: ExcalidrawEditorProps) {
  const [Excalidraw, setExcalidraw] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
    return undefined;
  }, [fullscreen]);

  useEffect(() => {
    import('@excalidraw/excalidraw')
      .then((mod) => {
        setExcalidraw(() => mod.Excalidraw);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Excalidraw:', err);
        setError('Failed to load drawing editor');
        setLoading(false);
      });
  }, []);

  const handleChange = useCallback(
    (elements: readonly any[], appState: Record<string, unknown>) => {
      if (onChangeRef.current) {
        onChangeRef.current({
          elements: elements.map((el) => ({ ...el })),
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            zoom: appState.zoom,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
          },
        });
      }
    },
    []
  );

  if (error) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Text c="red" ta="center">{error}</Text>
      </Paper>
    );
  }

  if (loading || !Excalidraw) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Group justify="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">Loading drawing editor...</Text>
        </Group>
      </Paper>
    );
  }

  // Prepare safe initialData with constrained zoom and scroll
  const safeInitialData = initialData
    ? {
        elements: (initialData.elements as any[]) || [],
        appState: {
          viewBackgroundColor: '#ffffff',
          currentItemStrokeColor: '#000000',
          currentItemBackgroundColor: 'transparent',
          currentItemFillStyle: 'solid',
          currentItemStrokeWidth: 1,
          currentItemRoughness: 1,
          currentItemOpacity: 100,
          zoom: { value: 1 }, // Force zoom to 1x
          scrollX: 0, // Force scroll to origin
          scrollY: 0,
          ...(initialData.appState as any || {}),
          // Override any extreme values from saved data
          gridSize: null,
        },
      }
    : {
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff',
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
          gridSize: null,
        },
      };

  const excalidrawProps: Record<string, unknown> = {
    initialData: safeInitialData,
    viewModeEnabled: readOnly,
    theme: 'light',
    gridModeEnabled: false,
  };

  if (!readOnly) {
    excalidrawProps.onChange = handleChange;
  }

  const toggleButton = (
    <Tooltip label={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'} position="left">
      <ActionIcon
        variant="default"
        size="md"
        onClick={() => setFullscreen((f) => !f)}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
        }}
        aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
      >
        {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </ActionIcon>
    </Tooltip>
  );

  const editorContent = (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxWidth: '1200px', // Limit container width to prevent huge canvas
        margin: '0 auto',
      }}
    >
      <Excalidraw {...excalidrawProps} />
    </div>
  );

  if (fullscreen) {
    return (
      <>
        {/* Keep the inline placeholder so layout doesn't jump */}
        <Stack gap="xs">
          {label && <Title order={4}>{label}</Title>}
          <Paper withBorder radius="md" p="xl" style={{
            height: typeof height === 'number' ? `${height}px` : height,
          }}>
            <Group justify="center" py="xl">
              <Text size="sm" c="dimmed">Drawing is in full screen mode</Text>
            </Group>
          </Paper>
        </Stack>

        {/* Fullscreen overlay via Portal */}
        <Portal>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'var(--mantine-color-body, #fff)',
            }}
          >
            {toggleButton}
            {editorContent}
          </div>
        </Portal>
      </>
    );
  }

  return (
    <Stack gap="xs">
      {label && <Title order={4}>{label}</Title>}
      <div
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          width: '100%',
          position: 'relative',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
        }}
      >
        {toggleButton}
        {editorContent}
      </div>
    </Stack>
  );
}
