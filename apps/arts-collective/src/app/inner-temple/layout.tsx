import type { ReactNode } from 'react';

export const metadata = {
  title: 'Inner Temple',
  description: 'Enter the elemental sanctuary.',
};

export default function InnerTempleLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
