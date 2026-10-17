import React from 'react';

/**
 * Reusable blueprint corner tick marks for cards, buttons, and drop-caps.
 * Inspired by technical engineering schematics.
 */
export default function CornerTicks({ strokeColor = 'currentColor', strokeWidth = 1.5, size = 8 }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="bb-corner-tick bb-corner-tick--tl"
        style={{ position: 'absolute', pointerEvents: 'none', lineHeight: 0, top: -1, left: -1 }}
      >
        <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
          <path d="M 1.250 10.000 L 1.250 1.250 L 10.000 1.250" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="butt" fill="none" />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className="bb-corner-tick bb-corner-tick--tr"
        style={{ position: 'absolute', pointerEvents: 'none', lineHeight: 0, top: -1, right: -1 }}
      >
        <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
          <path d="M 0.000 1.250 L 8.750 1.250 L 8.750 10.000" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="butt" fill="none" />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className="bb-corner-tick bb-corner-tick--bl"
        style={{ position: 'absolute', pointerEvents: 'none', lineHeight: 0, bottom: -1, left: -1 }}
      >
        <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
          <path d="M 1.250 0.000 L 1.250 8.750 L 10.000 8.750" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="butt" fill="none" />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className="bb-corner-tick bb-corner-tick--br"
        style={{ position: 'absolute', pointerEvents: 'none', lineHeight: 0, bottom: -1, right: -1 }}
      >
        <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
          <path d="M 0.000 8.750 L 8.750 8.750 L 8.750 0.000" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="butt" fill="none" />
        </svg>
      </span>
    </>
  );
}
