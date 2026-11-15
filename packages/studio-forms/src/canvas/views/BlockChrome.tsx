'use client';

import * as React from 'react';

/**
 * The controls every block view shares: a width toggle for blocks that can
 * break out, and remove. Rendered inside the node view wrapper, shown on
 * hover or selection by canvas.css. Move is the drag handle's business.
 */
export function WidthToggle({
  value,
  onChange,
  allow = ['content', 'wide', 'full'],
}: {
  value: 'content' | 'wide' | 'full';
  onChange: (w: 'content' | 'wide' | 'full') => void;
  allow?: Array<'content' | 'wide' | 'full'>;
}) {
  const sizes = { content: 10, wide: 16, full: 22 };
  return (
    <div className="studio-cv__wtog" role="group" aria-label="Width" contentEditable={false}>
      {allow.map((w) => (
        <button
          key={w}
          type="button"
          title={w === 'content' ? 'As wide as the text' : w === 'wide' ? 'Wider than the text' : 'The full page'}
          aria-pressed={value === w}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(w)}
        >
          <i style={{ width: sizes[w] }} />
        </button>
      ))}
    </div>
  );
}

export function BlockTools({ onRemove, children }: { onRemove: () => void; children?: React.ReactNode }) {
  return (
    <div className="studio-cv__tools" contentEditable={false}>
      {children}
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
