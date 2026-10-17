import React from 'react';
import Container from './Container.jsx';

/**
 * Editorial Construction Divider Rule
 * Provides subtle dashed, dotted, or solid line dividers.
 */
export default function Divider({
  variant = 'dashed', // 'dashed' | 'dotted' | 'solid'
  container = false,
  className = '',
  ...rest
}) {
  const variantClass = variant === 'dotted'
    ? 'bb-divider--dotted'
    : variant === 'solid'
    ? 'bb-divider--solid'
    : 'bb-divider--dashed';

  const rule = (
    <hr
      className={`bb-divider ${variantClass} ${className}`.trim()}
      aria-hidden="true"
      {...rest}
    />
  );

  if (container) {
    return <Container>{rule}</Container>;
  }

  return rule;
}
