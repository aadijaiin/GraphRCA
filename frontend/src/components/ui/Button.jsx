import React from 'react';
import CornerTicks from './CornerTicks.jsx';

/**
 * Reusable Editorial Button Component
 * Supports solid dark pill, dashed editorial with corner ticks, and subtle text variants.
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'editorial' | 'secondary' | 'subtle'
  size = 'md',        // 'sm' | 'md' | 'lg'
  href,
  onClick,
  className = '',
  type = 'button',
  target,
  rel,
  disabled = false,
  ariaLabel,
  ...rest
}) {
  const isEditorial = variant === 'editorial' || variant === 'secondary';
  const variantClass = isEditorial
    ? 'bb-btn--editorial'
    : variant === 'subtle'
    ? 'bb-btn--subtle'
    : 'bb-btn--primary';

  const sizeClass = size === 'sm'
    ? 'bb-btn--sm'
    : size === 'lg'
    ? 'bb-btn--lg'
    : 'bb-btn--md';

  const combinedClasses = `bb-btn ${variantClass} ${sizeClass} ${className}`.trim();

  if (href) {
    return (
      <a
        href={href}
        className={combinedClasses}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : rel}
        aria-label={ariaLabel}
        {...rest}
      >
        <span>{children}</span>
        {isEditorial && <CornerTicks />}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={combinedClasses}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...rest}
    >
      <span>{children}</span>
      {isEditorial && <CornerTicks />}
    </button>
  );
}
