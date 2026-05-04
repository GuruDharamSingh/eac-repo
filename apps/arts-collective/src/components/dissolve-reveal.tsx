"use client";

import { useEffect, useState } from "react";

export function DissolveReveal() {
  const [dissolved, setDissolved] = useState(false);

  useEffect(() => {
    const hasSeen = sessionStorage.getItem("ac:landing-revealed");
    if (hasSeen) {
      setDissolved(true);
      return;
    }
    const t = setTimeout(() => {
      setDissolved(true);
      sessionStorage.setItem("ac:landing-revealed", "1");
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  if (dissolved) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 animate-[dissolve_1.8s_ease-out_forwards]"
      style={{
        background:
          "radial-gradient(ellipse at center, hsl(var(--accent) / 0.85) 0%, hsl(var(--background)) 70%)",
      }}
    >
      <style>{`
        @keyframes dissolve {
          0%   { opacity: 1; filter: blur(0px); }
          60%  { opacity: 0.7; filter: blur(6px); }
          100% { opacity: 0; filter: blur(18px); }
        }
      `}</style>
    </div>
  );
}
