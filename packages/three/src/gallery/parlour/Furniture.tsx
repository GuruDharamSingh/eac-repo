import React, { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { Clone, useGLTF } from '@react-three/drei';
import { Mesh, MeshStandardMaterial, type Texture } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { CHAIRS, COFFEE_TABLE, SOFA, VASE } from './layout';
import type { ParlourAssets } from './types';

/**
 * A dark pool under a piece of furniture. The canvas renders without shadow
 * maps — the gallery never needed them — and a blob is what grounds a chair
 * on a floor at a fraction of the cost.
 */
function Shadow({
  texture,
  position,
  size,
  rotationY = 0,
  opacity = 0.85,
}: {
  texture: Texture;
  position: [number, number, number];
  size: [number, number];
  rotationY?: number;
  opacity?: number;
}) {
  return (
    <mesh position={[position[0], 0.012, position[2]]} rotation={[-Math.PI / 2, 0, rotationY]}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/**
 * The coffee table arrives as a bare OBJ (3ds Max, centimetres, long axis on
 * Z, no material), so it is scaled, turned to run across the sofa, and given a
 * polished mahogany here.
 */
function CoffeeTable({ url }: { url: string }) {
  const source = useLoader(OBJLoader, url);
  const table = useMemo(() => {
    const object = source.clone(true);
    const wood = new MeshStandardMaterial({ color: '#3b1c10', roughness: 0.32, metalness: 0.05 });
    object.traverse((child) => {
      if (child instanceof Mesh) child.material = wood;
    });
    return object;
  }, [source]);

  return (
    <primitive
      object={table}
      position={COFFEE_TABLE.position}
      rotation={[0, Math.PI / 2, 0]}
      scale={0.01}
    />
  );
}

function Model({
  url,
  position,
  rotationY = 0,
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const { scene } = useGLTF(url);
  // `Clone`, because the two armchairs are one file: a loaded scene can only
  // have one parent, so mounting it twice would move it rather than copy it.
  return <Clone object={scene} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

export function ParlourFurniture({ assets, shadow }: { assets: ParlourAssets; shadow: Texture }) {
  return (
    <>
      {/* The sofa faces the art, so its front (+Z in the file) is turned north. */}
      <Model url={assets.sofaUrl} position={SOFA.position} rotationY={Math.PI} scale={SOFA.scale} />
      <Shadow texture={shadow} position={SOFA.position} size={[2.2, 1.1]} />

      {CHAIRS.map((chair) => (
        <React.Fragment key={chair.id}>
          <Model url={assets.armchairUrl} position={chair.position} rotationY={chair.rotationY} />
          <Shadow texture={shadow} position={chair.position} size={[1.1, 1.1]} />
        </React.Fragment>
      ))}

      <CoffeeTable url={assets.coffeeTableUrl} />
      <Shadow texture={shadow} position={COFFEE_TABLE.position} size={[1.5, 0.95]} opacity={0.7} />

      <Model url={assets.vaseUrl} position={VASE.position} scale={VASE.scale} />
      <Shadow texture={shadow} position={VASE.position} size={[0.55, 0.55]} />
    </>
  );
}
