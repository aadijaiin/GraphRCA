import React from 'react';

/**
 * Editorial Container Component
 * Enforces unified horizontal margins and responsive padding.
 */
export default function Container({
  children,
  className = '',
  size = 'default',
  as: Component = 'div',
  ...rest
}) {
  const sizeClass = size === 'narrow' ? 'bb-container--narrow' : 'bb-container--default';
  return (
    <Component className={`bb-container ${sizeClass} ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
}
