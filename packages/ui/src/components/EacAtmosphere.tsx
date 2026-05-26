'use client';

import type { ReactNode } from 'react';

export interface EacAtmosphereProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function EacAtmosphere({ children, className, contentClassName }: EacAtmosphereProps) {
  const shellClassName = ['eac-atmosphere-shell', className].filter(Boolean).join(' ');
  const contentClass = ['eac-atmosphere-shell__content', contentClassName].filter(Boolean).join(' ');

  return (
    <div className={shellClassName}>
      <div className={contentClass}>{children}</div>
    </div>
  );
}