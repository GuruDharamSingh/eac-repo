'use client';

import { useEffect, useState } from 'react';
import { CanvasTexture, SRGBColorSpace, Texture, TextureLoader } from 'three';

export interface MediaTextureOptions {
  /**
   * Longest edge, in pixels, to downscale to before upload to the GPU.
   * Gallery originals are routinely several thousand pixels wide; decoded at
   * full size a handful of them costs more VRAM than the entire rest of a
   * scene, which phones will not survive.
   */
  maxSize?: number;
}

/**
 * Decodes off the main thread. The canvas path below blocks it for the whole
 * decode of a multi-thousand-pixel image, which a running frame loop feels as
 * a stutter for every picture that arrives.
 */
async function loadViaBitmap(url: string, maxSize: number): Promise<Texture | null> {
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) return null;

    let bitmap = await createImageBitmap(await response.blob());

    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest > maxSize) {
      const scale = maxSize / longest;
      const resized = await createImageBitmap(bitmap, {
        resizeWidth: Math.max(1, Math.round(bitmap.width * scale)),
        resizeHeight: Math.max(1, Math.round(bitmap.height * scale)),
        resizeQuality: 'high',
      });
      bitmap.close();
      bitmap = resized;
    }

    const texture = new Texture(bitmap);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    // Lets a consumer trace a texture back to the thing it depicts.
    texture.userData.src = url;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return null;
  }
}

function loadDownscaled(url: string, maxSize: number): Promise<Texture | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      texture.userData.src = url;
      resolve(texture);
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * Loads app-served images (`/api/media/...`, avatar URLs) as colour textures.
 *
 * Media URLs are permission-checked and can legitimately 404 or 403 for a given
 * viewer, so failures are dropped rather than thrown — a decorative scene must
 * not blank the page because one image went away. Textures are disposed on
 * unmount; without that the GPU keeps every image a visitor has scrolled past.
 */
/**
 * `Texture.dispose()` frees the GPU upload but not an `ImageBitmap` backing
 * store, which holds decoded pixels until it is closed explicitly.
 */
function releaseTexture(texture: Texture): void {
  const image = texture.image as { close?: () => void } | undefined;
  texture.dispose();
  if (typeof image?.close === 'function') image.close();
}

export function useMediaTextures(
  urls: readonly string[],
  options: MediaTextureOptions = {},
): Texture[] {
  const key = urls.join('\n');
  const { maxSize } = options;
  const [textures, setTextures] = useState<Texture[]>([]);

  useEffect(() => {
    const list = key ? key.split('\n') : [];
    if (list.length === 0) {
      setTextures([]);
      return;
    }

    let cancelled = false;
    const loader = new TextureLoader();
    loader.setCrossOrigin('anonymous');
    const loaded: Texture[] = [];

    Promise.all(
      list.map((url) =>
        maxSize
          ? typeof createImageBitmap === 'function'
            ? loadViaBitmap(url, maxSize).then((t) => t ?? loadDownscaled(url, maxSize))
            : loadDownscaled(url, maxSize)
          : new Promise<Texture | null>((resolve) => {
              loader.load(
                url,
                (texture) => {
                  texture.colorSpace = SRGBColorSpace;
                  texture.anisotropy = 4;
                  texture.userData.src = url;
                  resolve(texture);
                },
                undefined,
                () => resolve(null),
              );
            }),
      ),
    ).then((results) => {
      for (const texture of results) {
        if (!texture) continue;
        if (cancelled) {
          releaseTexture(texture);
          continue;
        }
        loaded.push(texture);
      }
      if (!cancelled) setTextures(loaded);
    });

    return () => {
      cancelled = true;
      for (const texture of loaded) releaseTexture(texture);
    };
  }, [key, maxSize]);

  return textures;
}
