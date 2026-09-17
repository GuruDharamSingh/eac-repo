import { Suspense } from 'react';
import { Splat } from '@react-three/drei';

export interface SplatObjectProps {
  /** A `.splat` / `.ksplat` capture, served like any other media file. */
  src: string;
  position?: [number, number, number];
  /** Roughly how large the capture should read, longest edge, in metres. */
  size?: number;
}

/**
 * A Gaussian-splat capture standing in for a photograph.
 *
 * drei ships the renderer, so the hard part — sorting several hundred thousand
 * splats back-to-front every time the camera moves — is not ours. What is ours
 * is deciding where they are worth it: a capture is tens of megabytes against a
 * photo's tens of kilobytes, and its cost is paid on load and then again on
 * every frame. One on a plinth is a centrepiece; a roomful is a phone that
 * never finishes loading.
 *
 * Two things to know before putting one in a room. Splats are transparent, so
 * they do not depth-sort correctly against ordinary geometry — keep them clear
 * of the vitrine glass rather than inside it. And a capture arrives in whatever
 * scale and orientation the capture tool chose; `size` normalises the scale,
 * but a capture that comes in lying on its side has to be rotated at the
 * source, since nothing here can know which way up it was meant to be.
 */
export function SplatObject({ src, position = [0, 0, 0], size = 0.5 }: SplatObjectProps) {
  return (
    <Suspense fallback={null}>
      <group position={position} scale={size}>
        <Splat src={src} />
      </group>
    </Suspense>
  );
}
