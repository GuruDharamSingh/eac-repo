import React, { useMemo } from 'react';
import { DoubleSide, type Texture } from 'three';
import {
  DADO_Y,
  FRENCH_DOORS,
  HALF_D,
  HALF_W,
  PARLOUR,
  PICTURE_RAIL_Y,
  SIDE_DOOR,
  WALL_THICKNESS,
} from './layout';
import { PANEL_TILE, PAPER_TILE, FLOOR_TILE, type ParlourTextures } from './textures';

const WOOD = '#2c160d';
const FRIEZE = '#cdbb92';
const CEILING = '#d6c7a6';
const DOOR_PAINT = '#d8cfbb';

interface Opening {
  x: number;
  width: number;
  height: number;
}

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** A horizontal band of wall, cut around an opening where the two overlap. */
function bandRects(length: number, y0: number, y1: number, opening?: Opening): Rect[] {
  const full = { x0: -length / 2, x1: length / 2, y0, y1 };
  if (!opening || opening.height <= y0) return [full];
  const ox0 = opening.x - opening.width / 2;
  const ox1 = opening.x + opening.width / 2;
  const rects: Rect[] = [
    { x0: -length / 2, x1: ox0, y0, y1 },
    { x0: ox1, x1: length / 2, y0, y1 },
  ];
  if (opening.height < y1) rects.push({ x0: ox0, x1: ox1, y0: opening.height, y1 });
  return rects;
}

/** A run of moulding at height `y`, broken where it would cross an opening. */
function railSegments(length: number, y: number, opening?: Opening): Array<[number, number]> {
  if (!opening || opening.height <= y) return [[-length / 2, length / 2]];
  return [
    [-length / 2, opening.x - opening.width / 2],
    [opening.x + opening.width / 2, length / 2],
  ];
}

function TiledRect({
  rect,
  texture,
  tileW,
  tileH,
  originX,
  originY,
}: {
  rect: Rect;
  texture: Texture;
  tileW: number;
  tileH: number;
  originX: number;
  originY: number;
}) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  // Each rect takes its own view of the shared image, offset by where it
  // starts on the wall, so the pattern runs on unbroken across a cut.
  const map = useMemo(() => {
    const t = texture.clone();
    t.repeat.set(w / tileW, h / tileH);
    t.offset.set((rect.x0 - originX) / tileW, (rect.y0 - originY) / tileH);
    t.needsUpdate = true;
    return t;
  }, [texture, w, h, tileW, tileH, rect.x0, rect.y0, originX, originY]);

  return (
    <mesh position={[(rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, 0]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} roughness={0.9} />
    </mesh>
  );
}

function Moulding({
  segments,
  y,
  height,
  depth,
  colour = WOOD,
}: {
  segments: Array<[number, number]>;
  y: number;
  height: number;
  depth: number;
  colour?: string;
}) {
  return (
    <>
      {segments.map(([a, b]) => (
        <mesh key={a} position={[(a + b) / 2, y, depth / 2]}>
          <boxGeometry args={[b - a, height, depth]} />
          <meshStandardMaterial color={colour} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

/**
 * One wall in its own frame: X along the wall, Y up, the room on +Z. Laid out
 * as an Edwardian elevation — skirting, panelled dado, papered field, picture
 * rail, a pale frieze and a cornice.
 */
function Wall({
  length,
  position,
  rotationY,
  opening,
  textures,
  children,
}: {
  length: number;
  position: [number, number, number];
  rotationY: number;
  opening?: Opening;
  textures: ParlourTextures;
  children?: React.ReactNode;
}) {
  const h = PARLOUR.height;
  const originX = -length / 2;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {bandRects(length, 0, DADO_Y, opening).map((r) => (
        <TiledRect
          key={`p${r.x0}`}
          rect={r}
          texture={textures.panel}
          tileW={PANEL_TILE.width}
          tileH={PANEL_TILE.height}
          originX={originX}
          originY={0}
        />
      ))}
      {bandRects(length, DADO_Y, PICTURE_RAIL_Y, opening).map((r) => (
        <TiledRect
          key={`w${r.x0}${r.y0}`}
          rect={r}
          texture={textures.paper}
          tileW={PAPER_TILE}
          tileH={PAPER_TILE}
          originX={originX}
          originY={DADO_Y}
        />
      ))}
      {bandRects(length, PICTURE_RAIL_Y, h, opening).map((r) => (
        <mesh key={`f${r.x0}`} position={[(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0]}>
          <planeGeometry args={[r.x1 - r.x0, r.y1 - r.y0]} />
          <meshStandardMaterial color={FRIEZE} roughness={0.95} />
        </mesh>
      ))}

      <Moulding segments={railSegments(length, 0.1, opening)} y={0.1} height={0.2} depth={0.028} />
      <Moulding segments={railSegments(length, DADO_Y, opening)} y={DADO_Y} height={0.055} depth={0.04} />
      <Moulding segments={railSegments(length, PICTURE_RAIL_Y, opening)} y={PICTURE_RAIL_Y} height={0.04} depth={0.03} />
      {/* Cornice, stepped so it reads as a profile rather than a plank. */}
      <Moulding segments={[[-length / 2, length / 2]]} y={h - 0.07} height={0.14} depth={0.13} colour="#e0d2b1" />
      <Moulding segments={[[-length / 2, length / 2]]} y={h - 0.18} height={0.08} depth={0.07} colour="#e0d2b1" />

      {opening && <Surround opening={opening} />}
      {children}
    </group>
  );
}

/** Architrave on the room face, and the reveal through the wall's thickness. */
function Surround({ opening }: { opening: Opening }) {
  const { x, width, height } = opening;
  const trim = 0.11;
  const ox0 = x - width / 2;
  const ox1 = x + width / 2;

  return (
    <>
      {[ox0 - trim / 2, ox1 + trim / 2].map((tx) => (
        <mesh key={tx} position={[tx, (height + trim) / 2, 0.018]}>
          <boxGeometry args={[trim, height + trim, 0.036]} />
          <meshStandardMaterial color={WOOD} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[x, height + trim / 2, 0.018]}>
        <boxGeometry args={[width + trim * 2, trim, 0.036]} />
        <meshStandardMaterial color={WOOD} roughness={0.5} />
      </mesh>

      <mesh position={[ox0, height / 2, -WALL_THICKNESS / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[WALL_THICKNESS, height]} />
        <meshStandardMaterial color={WOOD} roughness={0.6} />
      </mesh>
      <mesh position={[ox1, height / 2, -WALL_THICKNESS / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[WALL_THICKNESS, height]} />
        <meshStandardMaterial color={WOOD} roughness={0.6} />
      </mesh>
      <mesh position={[x, height, -WALL_THICKNESS / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, WALL_THICKNESS]} />
        <meshStandardMaterial color={WOOD} roughness={0.6} />
      </mesh>
      <mesh position={[x, 0.004, -WALL_THICKNESS / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, WALL_THICKNESS]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.6} />
      </mesh>
    </>
  );
}

/**
 * A pair of glazed doors, closed: a solid lower panel, then five rows of two
 * panes each. Painted, as garden doors of the period usually were.
 */
function FrenchDoors() {
  const { x, width, height } = FRENCH_DOORS;
  const leaf = width / 2;
  const stile = 0.07;
  const glassBottom = 0.62;
  const glassTop = height - 0.09;
  const rows = 5;

  return (
    <group position={[x, 0, -WALL_THICKNESS * 0.6]}>
      {[-1, 1].map((side) => {
        const cx = (side * leaf) / 2;
        const inner = leaf - stile * 2;
        const paneH = (glassTop - glassBottom) / rows;
        return (
          <group key={side} position={[cx, 0, 0]}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[(s * (leaf - stile)) / 2, height / 2, 0]}>
                <boxGeometry args={[stile, height, 0.05]} />
                <meshStandardMaterial color={DOOR_PAINT} roughness={0.55} />
              </mesh>
            ))}
            <mesh position={[0, height - 0.045, 0]}>
              <boxGeometry args={[inner, 0.09, 0.05]} />
              <meshStandardMaterial color={DOOR_PAINT} roughness={0.55} />
            </mesh>
            {/* Lower panel. */}
            <mesh position={[0, glassBottom / 2, 0]}>
              <boxGeometry args={[inner, glassBottom, 0.045]} />
              <meshStandardMaterial color={DOOR_PAINT} roughness={0.6} />
            </mesh>
            {Array.from({ length: rows - 1 }, (_, r) => (
              <mesh key={r} position={[0, glassBottom + paneH * (r + 1), 0]}>
                <boxGeometry args={[inner, 0.022, 0.03]} />
                <meshStandardMaterial color={DOOR_PAINT} roughness={0.55} />
              </mesh>
            ))}
            <mesh position={[0, (glassBottom + glassTop) / 2, 0]}>
              <boxGeometry args={[0.022, glassTop - glassBottom, 0.03]} />
              <meshStandardMaterial color={DOOR_PAINT} roughness={0.55} />
            </mesh>
            <mesh position={[0, (glassBottom + glassTop) / 2, 0]}>
              <planeGeometry args={[inner, glassTop - glassBottom]} />
              <meshStandardMaterial
                color="#9fb3c4"
                transparent
                opacity={0.14}
                roughness={0.05}
                metalness={0.2}
                depthWrite={false}
                side={DoubleSide}
              />
            </mesh>
            {/* Lever handle on the meeting stile. */}
            <mesh position={[-side * (leaf / 2 - stile / 2), 1.05, 0.045]}>
              <sphereGeometry args={[0.022, 12, 12]} />
              <meshStandardMaterial color="#b08a4a" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * The garden beyond the French doors: a terrace and a painted dusk. Lit by its
 * own cool light so it reads as outside even through glass.
 */
function Outdoors({ textures }: { textures: ParlourTextures }) {
  const doorZ = -FRENCH_DOORS.x;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-HALF_W - 4.5, -0.02, doorZ - 3]}>
        <planeGeometry args={[9, 18]} />
        <meshStandardMaterial color="#3d3a34" roughness={0.95} />
      </mesh>
      {/* Low stone balustrade at the terrace edge. */}
      <mesh position={[-HALF_W - 3.2, 0.3, doorZ - 3]}>
        <boxGeometry args={[0.3, 0.6, 18]} />
        <meshStandardMaterial color="#5a5650" roughness={0.9} />
      </mesh>
      <mesh position={[-HALF_W - 9, 3.2, doorZ - 5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[28, 12]} />
        <meshBasicMaterial map={textures.dusk} toneMapped={false} />
      </mesh>
      <pointLight position={[-HALF_W - 1.4, 2.2, doorZ]} color="#7f97c8" intensity={2.4} distance={7} decay={2} />
    </group>
  );
}

/**
 * The room through the side door, left ajar: oxblood walls, a lamp, the
 * shapes of a bookcase. Deliberately undetailed — it is there to say the house
 * goes on, which is most of what makes a room feel lived in.
 */
function NextRoom() {
  const depth = 3.2;
  const width = 4.2;
  const h = 2.9;
  const x0 = HALF_W + WALL_THICKNESS;
  const cx = x0 + depth / 2;
  // Set north of the doorway, which is where a seated eye looks through it.
  const cz = SIDE_DOOR.x - 1.15;
  const books = useMemo(() => {
    const rand = (() => {
      let s = 7;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    const colours = ['#4a1f1a', '#26324a', '#3d3a22', '#5a4630', '#2a3a2c', '#6b5a3a'];
    const out: Array<{ z: number; y: number; w: number; h: number; c: string }> = [];
    for (let shelf = 0; shelf < 5; shelf++) {
      let z = -1.9;
      while (z < 0.1) {
        const w = 0.03 + rand() * 0.05;
        out.push({ z: z + w / 2, y: 0.35 + shelf * 0.42, w, h: 0.22 + rand() * 0.1, c: colours[Math.floor(rand() * colours.length)]! });
        z += w + 0.004;
      }
    }
    return out;
  }, []);

  return (
    <group position={[cx, 0, cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[depth, width]} />
        <meshStandardMaterial color="#2e1b10" roughness={0.8} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[depth, width]} />
        <meshStandardMaterial color="#8a7a5c" roughness={1} />
      </mesh>
      <mesh position={[depth / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[width, h]} />
        <meshStandardMaterial color="#4a1c18" roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, h / 2, (s * width) / 2]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[depth, h]} />
          <meshStandardMaterial color="#4a1c18" roughness={0.95} />
        </mesh>
      ))}

      {/* Bookcase against the far wall. */}
      <group position={[depth / 2 - 0.2, 0, -0.9]}>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.36, 2.2, 2.1]} />
          <meshStandardMaterial color="#1f100a" roughness={0.6} />
        </mesh>
        {books.map((b, i) => (
          <mesh key={i} position={[-0.2, b.y + b.h / 2, b.z + 0.9]}>
            <boxGeometry args={[0.04, b.h, b.w]} />
            <meshStandardMaterial color={b.c} roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* A table lamp, which is all the light this room has. */}
      <group position={[-0.2, 0, -0.4]}>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.72, 24]} />
          <meshStandardMaterial color="#24130b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <cylinderGeometry args={[0.12, 0.2, 0.24, 24, 1, true]} />
          <meshStandardMaterial color="#ffd49a" emissive="#ffb35c" emissiveIntensity={1.6} side={DoubleSide} />
        </mesh>
        <pointLight position={[0, 1.0, 0]} color="#ffa95e" intensity={3.2} distance={4.2} decay={2} />
      </group>
    </group>
  );
}

/** The side door, a panelled mahogany leaf swung open into the next room. */
function SideDoorLeaf() {
  const { width, height } = SIDE_DOOR;
  const leafW = width - 0.03;
  const leafH = height - 0.02;
  // In world space: the hinge is on the south jamb, at the back of the wall.
  const hingeZ = SIDE_DOOR.x + width / 2;
  const x = HALF_W + WALL_THICKNESS;

  return (
    <group position={[x, 0, hingeZ]} rotation={[0, -1.82, 0]}>
      <group position={[0, leafH / 2, -leafW / 2]}>
        <mesh>
          <boxGeometry args={[0.045, leafH, leafW]} />
          <meshStandardMaterial color="#3a1a10" roughness={0.45} />
        </mesh>
        {[0.45, -0.35].map((py) =>
          [-1, 1].map((pz) => (
            <mesh key={`${py}${pz}`} position={[0.026, py, (pz * leafW) / 4.4]}>
              <boxGeometry args={[0.012, py > 0 ? 0.8 : 0.9, leafW / 2.8]} />
              <meshStandardMaterial color="#4a2416" roughness={0.45} />
            </mesh>
          )),
        )}
        <mesh position={[0.05, -0.08, -leafW / 2 + 0.07]}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshStandardMaterial color="#b08a4a" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

export function ParlourArchitecture({ textures }: { textures: ParlourTextures }) {
  const floorMap = useMemo(() => {
    const t = textures.floor.clone();
    t.repeat.set(PARLOUR.width / FLOOR_TILE, PARLOUR.depth / FLOOR_TILE);
    t.needsUpdate = true;
    return t;
  }, [textures.floor]);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PARLOUR.width, PARLOUR.depth]} />
        <meshStandardMaterial map={floorMap} roughness={0.42} metalness={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, PARLOUR.height, 0]}>
        <planeGeometry args={[PARLOUR.width, PARLOUR.depth]} />
        <meshStandardMaterial color={CEILING} roughness={1} />
      </mesh>

      <Wall length={PARLOUR.width} position={[0, 0, -HALF_D]} rotationY={0} textures={textures} />
      <Wall length={PARLOUR.width} position={[0, 0, HALF_D]} rotationY={Math.PI} textures={textures} />
      <Wall
        length={PARLOUR.depth}
        position={[-HALF_W, 0, 0]}
        rotationY={Math.PI / 2}
        opening={FRENCH_DOORS}
        textures={textures}
      >
        <FrenchDoors />
      </Wall>
      <Wall
        length={PARLOUR.depth}
        position={[HALF_W, 0, 0]}
        rotationY={-Math.PI / 2}
        opening={SIDE_DOOR}
        textures={textures}
      />

      <Outdoors textures={textures} />
      <NextRoom />
      <SideDoorLeaf />
    </>
  );
}
