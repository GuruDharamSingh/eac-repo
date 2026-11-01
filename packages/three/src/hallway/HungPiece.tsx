import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useCursor, useGLTF, Clone } from '@react-three/drei';
import { Box3, DoubleSide, Plane, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { useMediaTextures } from '../hooks/useMediaTextures';
import { HANG_GAP, SCALE_MAX, SCALE_MIN, placementScale, type Placement } from './layout';
import { faceById } from './venue';
import type { WallFace } from './layout';
import { frameScale, outerSize, type FrameStyle } from './frames';
import { lampLevel, markLit, pieceSize } from './sizing';
import { cropUv, isUncropped, placementCrop, placementRatio } from './framing';
import { useHallwayStore } from './store';
import { useCutaway } from './ViewRig';
import type { HallwayPiece } from './types';

const TEXTURE_MAX_SIZE = 1600;
const BRASS = '#b08a4a';
/** Corner handle: side in metres, and how far it stands off the frame's face. */
const HANDLE = 0.09;
const HANDLE_LIFT = 0.03;
const HANDLE_COLOUR = '#f2d08a';

export interface HungPieceProps {
  piece: HallwayPiece;
  placement: Placement;
  frame: FrameStyle;
  editable: boolean;
  /** Being carried to a new spot: drawn faded where it was. */
  lifted: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>, aspect: number) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  /** A corner handle was let go: the piece's new size multiplier. */
  onResize?: (scale: number) => void;
}

/**
 * The largest scale this piece can take where it hangs: inside the hang band,
 * on the wall, and clear of its neighbours on the same face. Neighbours are
 * treated as level with it, which they nearly always are, so the bound errs
 * on the safe side.
 */
export function maxScaleAt(
  placement: Placement,
  base: { width: number; height: number },
  face: WallFace,
  hang: { minBottom: number; maxTop: number },
  frame: FrameStyle,
  sizes: Record<string, { width: number; height: number }>,
  neighbours: readonly Placement[],
): number {
  const edge = outerSize(base.width, base.height, frame);
  const padW = edge.width - base.width;
  const padH = edge.height - base.height;
  let max = SCALE_MAX;
  const band = hang.maxTop - hang.minBottom - 0.2;
  max = Math.min(max, (band - padH) / base.height);
  max = Math.min(max, (face.length - 0.3 - padW) / base.width);
  for (const o of neighbours) {
    if (o.pieceId === placement.pieceId || o.wallId !== placement.wallId) continue;
    const os = sizes[o.pieceId];
    if (!os) continue;
    const clear = Math.abs(o.x - placement.x) - os.width / 2 - HANG_GAP;
    max = Math.min(max, (2 * clear - padW) / base.width);
  }
  return Math.max(SCALE_MIN, max);
}

/**
 * A framed work on a hallway wall, with its own picture lamp.
 *
 * The lamp comes up over a moment when the piece is first hung — the room
 * answering the curator's drop — and its warm throw on the wall is lit by the
 * shared pool in `PieceLights`, which serves whichever lamps are nearest.
 */
export function HungPiece({ piece, placement, frame, editable, lifted, onPointerDown, onClick, onResize }: HungPieceProps) {
  const venue = useHallwayStore((s) => s.venue)!;
  const face = faceById(venue, placement.wallId);
  const urls = useMemo(() => [piece.imageUrl], [piece.imageUrl]);
  const [texture] = useMediaTextures(urls, { maxSize: TEXTURE_MAX_SIZE });
  const hovered = useHallwayStore((s) => s.hoveredId === piece.id);
  const selected = useHallwayStore((s) => s.selectedId === piece.id);
  const resizing = useHallwayStore((s) => (s.resize?.pieceId === piece.id ? s.resize.scale : null));
  const setHoveredId = useHallwayStore((s) => s.setHoveredId);
  const setSize = useHallwayStore((s) => s.setSize);
  const setBaseSize = useHallwayStore((s) => s.setBaseSize);
  useCursor(hovered, editable ? 'grab' : 'pointer');

  const aspect = useMemo(() => {
    const image = texture?.image as { width?: number; height?: number } | undefined;
    return image?.width && image?.height ? image.width / image.height : (piece.aspect ?? 1);
  }, [texture, piece.aspect]);

  const ratio = placementRatio(placement);
  const crop = placementCrop(placement);
  const base = useMemo(() => pieceSize(piece, aspect, face?.length ?? 2, venue.hang, ratio), [piece, aspect, face, venue, ratio]);
  // The size multiplier: the handle's provisional value while one is dragged, else the placement's.
  const multiplier = resizing ?? placementScale(placement);
  const size = useMemo(
    () => ({ ...base, width: base.width * multiplier, height: base.height * multiplier }),
    [base, multiplier],
  );
  const outer = outerSize(size.width, size.height, frame);
  const scale = frameScale(frame, size.width, size.height);
  // A real frame holds the piece back inside its carving; a box frame shows it at its face.
  const faceZ = frame.modelOpening ? frame.depth * scale * (frame.imageRecess ?? 0.35) : frame.depth;

  useEffect(() => {
    setSize(piece.id, outer.width, outer.height);
  }, [piece.id, outer.width, outer.height, setSize]);
  useEffect(() => {
    setBaseSize(piece.id, base.width, base.height);
  }, [piece.id, base.width, base.height, setBaseSize]);

  // The picture inside the frame: `fitPiece`'s letterbox when shown as shot,
  // else a cover crop of the image into the frame at the placement's crop.
  const uv = useMemo(
    () => (isUncropped(ratio, crop) ? { repeat: size.repeat, offset: size.offset } : cropUv(aspect, size.width / size.height, crop)),
    [ratio, crop.x, crop.y, crop.zoom, size, aspect],
  );
  useEffect(() => {
    if (!texture) return;
    texture.repeat.set(uv.repeat[0], uv.repeat[1]);
    texture.offset.set(uv.offset[0], uv.offset[1]);
    texture.needsUpdate = true;
  }, [texture, uv]);

  useEffect(() => markLit(piece.id), [piece.id]);

  const lamp = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (lamp.current) lamp.current.emissiveIntensity = 1.6 * lampLevel(piece.id);
  });

  // Goes with its wall when the cutaway hides it, and stops taking clicks:
  // a hidden frame's back still faces the camera and would otherwise catch them.
  const root = useRef<Group>(null);
  useCutaway(face, root);
  const shown = () => root.current?.visible !== false;

  if (!face) return null;

  const mount = frame.mount ?? 0;
  const top = placement.y + outer.height / 2;
  const highlight = editable && (hovered || selected);

  return (
    <group ref={root} position={[face.centre[0], 0, face.centre[1]]} rotation={[0, face.rotationY, 0]}>
      <group
        position={[placement.x, placement.y, 0.02]}
        onPointerDown={(e) => shown() && onPointerDown?.(e, aspect)}
        onClick={(e) => shown() && onClick?.(e)}
        onPointerOver={(e) => {
          if (!shown()) return;
          e.stopPropagation();
          setHoveredId(piece.id);
        }}
        onPointerOut={() => setHoveredId(null)}
      >
        <FrameMoulding frame={frame} width={outer.width} height={outer.height} scale={scale} glow={highlight} faded={lifted} />
        {mount > 0 && (
          <mesh position={[0, 0, faceZ + 0.001]}>
            <planeGeometry args={[size.width + mount * 2, size.height + mount * 2]} />
            <meshStandardMaterial color={frame.mountColour ?? '#f4f0e8'} roughness={0.95} transparent={lifted} opacity={lifted ? 0.35 : 1} />
          </mesh>
        )}
        {/* See the gallery's HangingPiece for why the material is keyed. */}
        <mesh position={[0, 0, faceZ + 0.003]}>
          <planeGeometry args={[size.width, size.height]} />
          <meshStandardMaterial
            key={(texture ? texture.uuid : 'unloaded') + (lifted ? '-lifted' : '')}
            map={texture ?? null}
            emissiveMap={texture ?? null}
            color={texture ? '#ffffff' : '#cfc6b8'}
            emissive={texture ? '#ffffff' : '#000000'}
            emissiveIntensity={0.42}
            roughness={0.85}
            transparent={lifted}
            opacity={lifted ? 0.35 : 1}
          />
        </mesh>
      </group>

      {editable && selected && !lifted && face && (
        <ScaleHandles
          placement={placement}
          face={face}
          base={base}
          frame={frame}
          outer={outer}
          z={faceZ + HANDLE_LIFT}
          root={root}
          onResize={onResize}
        />
      )}

      {/* The picture lamp: a brass hood on a short arm above the frame. */}
      <group position={[placement.x, top + 0.1, 0]}>
        <mesh position={[0, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.18, 8]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.18]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, Math.min(0.7, outer.width * 0.5), 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -0.018, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(0.68, outer.width * 0.48), 0.04]} />
          <meshStandardMaterial ref={lamp} color="#3a2c18" emissive="#ffe2b0" emissiveIntensity={0} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Four corner handles on the selected piece. Dragging one scales the piece
 * about its centre, uniformly: the handle follows the pointer's distance from
 * the centre on the wall's plane, so the corner stays under the pointer. The
 * provisional scale is shown live through the store; the release commits it
 * through `onResize`. Bounded by `maxScaleAt`.
 */
function ScaleHandles({
  placement,
  face,
  base,
  frame,
  outer,
  z,
  root,
  onResize,
}: {
  placement: Placement;
  face: WallFace;
  base: { width: number; height: number };
  frame: FrameStyle;
  outer: { width: number; height: number };
  z: number;
  root: React.RefObject<Group | null>;
  onResize?: (scale: number) => void;
}) {
  const { camera, raycaster, pointer } = useThree();
  const setResize = useHallwayStore((s) => s.setResize);
  const [hover, setHover] = useState(false);
  useCursor(hover, 'nwse-resize');
  const drag = useRef<{ startDist: number; startScale: number; max: number } | null>(null);
  const plane = useMemo(() => new Plane(), []);
  const hit = useMemo(() => new Vector3(), []);

  /** The pointer's distance from the piece's centre, on the wall's plane, in the wall's frame. */
  const distance = () => {
    const group = root.current;
    if (!group) return null;
    const [wx, wz] = [face.centre[0] + face.xAxis[0] * placement.x, face.centre[1] + face.xAxis[1] * placement.x];
    plane.setFromNormalAndCoplanarPoint(new Vector3(face.normal[0], 0, face.normal[1]), new Vector3(wx, placement.y, wz));
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    const local = group.worldToLocal(hit.clone());
    return Math.hypot(local.x - placement.x, local.y - placement.y);
  };

  const start = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const state = useHallwayStore.getState();
    const d = distance();
    if (!d) return;
    const startScale = placementScale(placement);
    const max = maxScaleAt(placement, base, face, state.venue!.hang, frame, state.sizes, neighbourPlacements.current);
    drag.current = { startDist: d, startScale, max };
    state.setResize({ pieceId: placement.pieceId, scale: startScale });
    state.setPressing(true);
  };

  useFrame(() => {
    const d = drag.current;
    if (!d) return;
    const dist = distance();
    if (!dist) return;
    const next = Math.min(d.max, Math.max(SCALE_MIN, (d.startScale * dist) / d.startDist));
    const rounded = Math.round(next * 200) / 200;
    const current = useHallwayStore.getState().resize;
    if (!current || current.scale !== rounded) setResize({ pieceId: placement.pieceId, scale: rounded });
  });

  useEffect(() => {
    const onUp = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      const state = useHallwayStore.getState();
      const final = state.resize?.scale ?? d.startScale;
      state.setResize(null);
      state.setPressing(false);
      if (Math.abs(final - d.startScale) > 1e-3) onResize?.(final);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [onResize]);

  const corners: Array<[number, number]> = [
    [-outer.width / 2, outer.height / 2],
    [outer.width / 2, outer.height / 2],
    [outer.width / 2, -outer.height / 2],
    [-outer.width / 2, -outer.height / 2],
  ];
  // Handles keep a readable size from further back: scaled with distance.
  const dist = camera.position.distanceTo(new Vector3(...(root.current?.localToWorld(new Vector3(placement.x, placement.y, 0)).toArray() ?? [0, 0, 0])));
  const side = HANDLE * Math.max(1, dist / 4);

  return (
    <group position={[placement.x, placement.y, z]}>
      {corners.map(([cx, cy], i) => (
        <mesh
          key={i}
          position={[cx, cy, 0]}
          onPointerDown={start}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
          }}
          onPointerOut={() => setHover(false)}
        >
          <planeGeometry args={[side, side]} />
          <meshBasicMaterial color={HANDLE_COLOUR} toneMapped={false} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The placements on show, kept here for the handles' neighbour check. Set by
 * HallwayExperience on every render; a module ref rather than store state so
 * it never re-renders anything.
 */
export const neighbourPlacements: { current: readonly Placement[] } = { current: [] };

/** Procedural moulding, or the frame asset when the style names one. */
function FrameMoulding({
  frame,
  width,
  height,
  scale,
  glow,
  faded,
}: {
  frame: FrameStyle;
  width: number;
  height: number;
  /** `frameScale` for this piece: how much a real frame grows to hold it. */
  scale: number;
  glow: boolean;
  faded: boolean;
}) {
  const procedural = (
    <mesh position={[0, 0, frame.depth / 2]}>
      <boxGeometry args={[width, height, frame.depth]} />
      <meshStandardMaterial
        // Keyed so the fade applies: transparency is fixed when a shader compiles.
        key={faded ? 'faded' : 'solid'}
        color={frame.colour}
        metalness={frame.metalness ?? 0.05}
        roughness={frame.roughness ?? 0.6}
        emissive={frame.colour}
        emissiveIntensity={glow ? 0.5 : 0}
        transparent={faded}
        opacity={faded ? 0.35 : 1}
      />
    </mesh>
  );
  if (!frame.modelUrl) return procedural;
  return (
    <Suspense fallback={procedural}>
      {frame.modelOpening ? (
        <SlicedFrameModel
          url={frame.modelUrl}
          opening={frame.modelOpening}
          width={width}
          height={height}
          rail={frame.border * scale}
          depth={frame.depth * scale}
        />
      ) : (
        <FrameModel url={frame.modelUrl} width={width} height={height} depth={frame.depth} />
      )}
    </Suspense>
  );
}

/**
 * A real frame fitted to the piece by slicing: along each axis, the part of
 * the asset inside its opening is stretched to the new opening, and the part
 * outside (the rail) is moved out with it and scaled to `rail`. Corners and
 * carving keep their shape; only rail length changes.
 */
function SlicedFrameModel({
  url,
  opening,
  width,
  height,
  rail: railWidth,
  depth,
}: {
  url: string;
  opening: readonly [number, number];
  /** Outer size, moulding included. */
  width: number;
  height: number;
  rail: number;
  depth: number;
}) {
  const { scene } = useGLTF(url);
  const fitted = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root);
    const size = bounds.getSize(new Vector3());
    const half = [opening[0] / 2, opening[1] / 2];
    const rail = [size.x / 2 - half[0], size.y / 2 - half[1]];
    const target = [width / 2 - railWidth, height / 2 - railWidth];
    const fit = (v: number, axis: 0 | 1) => {
      const u = Math.abs(v);
      const mapped = u <= half[axis]! ? (u * target[axis]!) / half[axis]! : target[axis]! + ((u - half[axis]!) * railWidth) / (rail[axis]! || 1);
      return Math.sign(v) * mapped;
    };
    const zScale = depth / (size.z || 1);
    const meshes: Mesh[] = [];
    root.traverse((node) => {
      if ((node as Mesh).isMesh) meshes.push(node as Mesh);
    });
    for (const mesh of meshes) {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      const pos = geometry.attributes.position!;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i, fit(pos.getX(i), 0), fit(pos.getY(i), 1), (pos.getZ(i) - bounds.min.z) * zScale);
      }
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      mesh.geometry = geometry;
    }
    // Geometry now carries the world transform; flatten the hierarchy's own.
    root.traverse((node) => {
      node.position.set(0, 0, 0);
      node.quaternion.identity();
      node.scale.set(1, 1, 1);
    });
    return { root, meshes };
  }, [scene, opening, width, height, railWidth, depth]);
  useEffect(() => () => fitted.meshes.forEach((m) => m.geometry.dispose()), [fitted]);
  return <primitive object={fitted.root} />;
}

/**
 * A frame asset stretched to the piece: modelled around a unit opening, its
 * bounding box is scaled to the framed size here. See `FrameStyle.modelUrl`.
 */
function FrameModel({ url, width, height, depth }: { url: string; width: number; height: number; depth: number }) {
  const { scene } = useGLTF(url);
  const box = useMemo(() => new Box3().setFromObject(scene).getSize(new Vector3()), [scene]);
  return (
    <Clone
      object={scene}
      scale={[width / (box.x || 1), height / (box.y || 1), depth / (box.z || 1)]}
    />
  );
}
