import React from 'react';

/**
 * Editorial Section Component
 * Enforces unified vertical rhythm and semantic structure.
 */
export default function Section({
  children,
  className = '',
  id,
  surface = 'default',
  spacing = 'normal',
  as: Component = 'section',
  ...rest
}) {
  const surfaceClass = surface === 'light'
    ? 'bb-section--surface-light'
    : surface === 'dark'
    ? 'bb-section--surface-dark'
    : 'bb-section--surface-default';

  const spacingClass = spacing === 'compact'
    ? 'bb-section--spacing-compact'
    : spacing === 'none'
    ? 'bb-section--spacing-none'
    : 'bb-section--spacing-normal';

  return (
    <Component
      id={id}
      className={`bb-section ${surfaceClass} ${spacingClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}
