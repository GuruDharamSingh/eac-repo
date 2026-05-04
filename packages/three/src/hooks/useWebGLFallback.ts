import { useEffect, useState } from 'react';

export function useWebGLFallback(): boolean {
  const [noWebGL, setNoWebGL] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (!gl) setNoWebGL(true);
    } catch {
      setNoWebGL(true);
    }
  }, []);

  return noWebGL;
}
