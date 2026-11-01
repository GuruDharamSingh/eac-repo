import { Suspense, useEffect, useMemo } from 'react';
import { DoubleSide, Object3D, type Texture } from 'three';
import { useMediaTextures } from '../../hooks/useMediaTextures';
import { fitPiece } from '../room';
import type { GalleryPiece } from '../types';
import {
  ART_CENTRE_Y,
  ART_MAX_HEIGHT,
  ART_MAX_WIDTH,
  ART_MIN_BOTTOM,
  HALF_D,
  PICTURE_RAIL_Y,
  getSeat,
  type ParlourSeatId,
} from './layout';
import { createParlourTextures, disposeParlourTextures } from './textures';
import { ParlourArchitecture } from './Architecture';
import { ParlourFurniture } from './Furniture';
import { SeatCamera } from './SeatCamera';
import type { ParlourAssets } from './types';

/** Closer than in the gallery, so the painting is given a larger image. */
const TEXTURE_MAX_SIZE = 2048;

const GILT = '#a8823f';
const GILT_DEEP = '#6e5226';
const BRASS = '#b08a4a';
const WARM = '#ffb36b';

export interface ParlourSceneProps {
  piece: GalleryPiece;
  assets: ParlourAssets;
  seat?: ParlourSeatId;
}

/**
 * One painting at home: a low-lit Edwardian parlour, seen from the sofa or
 * from either armchair.
 *
 * Unlike the gallery, the work here takes the room's light. The gallery shows
 * a file as the file is, because it is selling the object; this view exists
 * to show how the piece would sit in a warm, dim room, which is a question
 * about light. A little of the image is carried as emission so the colour
 * still reads when the lamps are low.
 */
export function ParlourScene({ piece, assets, seat = 'sofa' }: ParlourSceneProps) {
  const textures = useMemo(() => createParlourTextures(), []);
  useEffect(() => () => disposeParlourTextures(textures), [textures]);

  const urls = useMemo(() => [piece.imageUrl], [piece.imageUrl]);
  const [texture] = useMediaTextures(urls, { maxSize: TEXTURE_MAX_SIZE });

  const size = useMemo(() => {
    const image = texture?.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    return fitPiece(piece, aspect, ART_MAX_WIDTH, ART_MAX_HEIGHT);
  }, [texture, piece]);

  const centreY = Math.min(
    PICTURE_RAIL_Y - 0.12 - size.height / 2,
    Math.max(ART_CENTRE_Y, ART_MIN_BOTTOM + size.height / 2),
  );
  // Aimed below the painting, as a seated eye rests: the table and rug are in
  // the frame with the work above them, which is the whole point of the view.
  const lookAt = useMemo<[number, number, number]>(() => [0, centreY - 0.95, -HALF_D], [centreY]);

  return (
    <>
      <color attach="background" args={['#070504']} />

      {/* Low, warm fill. The lamps do the rest. */}
      <ambientLight intensity={0.42} color="#ffd2a0" />
      <hemisphereLight args={['#3c4866', '#4a2c18', 0.4]} />

      <ParlourArchitecture textures={textures} />
      <Rug texture={textures.rug} />
      <Painting texture={texture ?? null} size={size} centreY={centreY} />
      <Sconces spread={size.width / 2 + 0.5} />
      <StandardLamp />

      <Suspense fallback={null}>
        <ParlourFurniture assets={assets} shadow={textures.shadow} />
      </Suspense>

      <SeatCamera seat={getSeat(seat)} lookAt={lookAt} />
    </>
  );
}

function Rug({ texture }: { texture: Texture }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0.15]}>
      <planeGeometry args={[3.1, 2.3]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </mesh>
  );
}

/**
 * The work in a gilt frame, hung from the picture rail on two brass cords,
 * with a picture light over it.
 */
function Painting({
  texture,
  size,
  centreY,
}: {
  texture: Texture | null;
  size: ReturnType<typeof fitPiece>;
  centreY: number;
}) {
  const { width, height } = size;
  const border = Math.min(0.14, Math.max(0.07, Math.max(width, height) * 0.07));
  const depth = 0.07;
  const wallZ = -HALF_D;
  const top = centreY + height / 2 + border;

  useEffect(() => {
    if (!texture) return;
    texture.repeat.set(size.repeat[0], size.repeat[1]);
    texture.offset.set(size.offset[0], size.offset[1]);
    texture.needsUpdate = true;
  }, [texture, size]);

  const target = useMemo(() => new Object3D(), []);
  target.position.set(0, centreY - height * 0.1, wallZ);

  return (
    <group>
      <group position={[0, centreY, wallZ + 0.03]}>
        <mesh position={[0, 0, depth / 2]}>
          <boxGeometry args={[width + border * 2, height + border * 2, depth]} />
          <meshStandardMaterial color={GILT} metalness={0.55} roughness={0.38} />
        </mesh>
        {/* Inner lip, a shade deeper, so the frame reads as moulded. */}
        <mesh position={[0, 0, depth + 0.006]}>
          <boxGeometry args={[width + border * 0.7, height + border * 0.7, 0.012]} />
          <meshStandardMaterial color={GILT_DEEP} metalness={0.5} roughness={0.45} />
        </mesh>
        {/* See HangingPiece for why the material is keyed on the texture. */}
        <mesh position={[0, 0, depth + 0.014]}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial
            key={texture ? texture.uuid : 'unloaded'}
            map={texture}
            emissiveMap={texture}
            color={texture ? '#ffffff' : '#3a332a'}
            emissive={texture ? '#ffffff' : '#000000'}
            emissiveIntensity={0.32}
            roughness={0.8}
          />
        </mesh>
      </group>

      {/* Cords up to the picture rail hooks. */}
      {[-1, 1].map((side) => {
        const x0 = side * (width / 2) * 0.55;
        const x1 = side * Math.min(width / 2 + 0.1, 1.2);
        const y0 = top - 0.02;
        const y1 = PICTURE_RAIL_Y - 0.01;
        const length = Math.hypot(x1 - x0, y1 - y0);
        if (y1 - y0 < 0.03) return null;
        return (
          <mesh
            key={side}
            position={[(x0 + x1) / 2, (y0 + y1) / 2, wallZ + 0.035]}
            rotation={[0, 0, Math.atan2(x0 - x1, y1 - y0)]}
          >
            <cylinderGeometry args={[0.003, 0.003, length, 6]} />
            <meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}

      {/* Picture light: a brass hood on an arm, throwing light down the canvas. */}
      <group position={[0, top + 0.08, wallZ]}>
        <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, Math.min(0.9, width * 0.55), 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -0.02, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(0.88, width * 0.54), 0.05]} />
          <meshBasicMaterial color="#fff1d6" toneMapped={false} />
        </mesh>
      </group>
      <primitive object={target} />
      <spotLight
        position={[0, top + 0.1, wallZ + 0.55]}
        target={target}
        angle={Math.min(1.2, 0.5 + width * 0.25)}
        penumbra={0.9}
        intensity={3.2}
        distance={5}
        decay={2}
        color="#ffe2b8"
      />
    </group>
  );
}

/** A pair of shaded wall lights flanking the painting. */
function Sconces({ spread }: { spread: number }) {
  const x = Math.min(2.05, Math.max(0.9, spread));
  const wallZ = -HALF_D;
  return (
    <>
      {[-x, x].map((sx) => (
        <group key={sx} position={[sx, 1.78, wallZ]}>
          <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.024, 20]} />
            <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.05, 0.09]} rotation={[0.9, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.2, 8]} />
            <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.2, 0.16]}>
            <cylinderGeometry args={[0.065, 0.1, 0.13, 24, 1, true]} />
            <meshStandardMaterial
              color="#f3d9a8"
              emissive={WARM}
              emissiveIntensity={1.3}
              side={DoubleSide}
            />
          </mesh>
          <pointLight position={[0, 0.18, 0.2]} color={WARM} intensity={2.6} distance={6} decay={2} />
        </group>
      ))}
    </>
  );
}

/** A standard lamp behind the left chair: a pool of light across the floor. */
function StandardLamp() {
  return (
    <group position={[-2.15, 0, 1.55]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.04, 24]} />
        <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 1.5, 8]} />
        <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.14, 0.26, 0.3, 28, 1, true]} />
        <meshStandardMaterial color="#e9c78f" emissive={WARM} emissiveIntensity={1.1} side={DoubleSide} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color={WARM} intensity={5} distance={7} decay={2} />
    </group>
  );
}
