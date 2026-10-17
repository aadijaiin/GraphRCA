import React from 'react';

/**
 * Technical Section Index Component (Antimetal Blueprint Style)
 * Renders uppercase monospace section indexing (e.g., "01 — ARCHITECTURE").
 */
export default function SectionIndex({
  number,
  label,
  className = '',
  ...rest
}) {
  return (
    <div className={`bb-section-index ${className}`.trim()} {...rest}>
      {number && <span className="bb-section-index__num">{number}</span>}
      {number && label && <span className="bb-section-index__sep" aria-hidden="true" />}
      {label && <span className="bb-section-index__label">{label}</span>}
    </div>
  );
}
