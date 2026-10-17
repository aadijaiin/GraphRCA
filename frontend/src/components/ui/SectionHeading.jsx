import React from 'react';

/**
 * Editorial Section Heading Component
 * Renders large serif headings with controlled line breaks and editorial lead paragraphs.
 */
export default function SectionHeading({
  title,
  lead,
  action,
  align = 'split', // 'split' | 'stacked' | 'center'
  className = '',
  titleTag: TitleTag = 'h2',
  ...rest
}) {
  const alignClass = align === 'stacked'
    ? 'bb-heading-layout--stacked'
    : align === 'center'
    ? 'bb-heading-layout--center'
    : 'bb-heading-layout--split';

  return (
    <div className={`bb-section-heading ${alignClass} ${className}`.trim()} {...rest}>
      <div className="bb-section-heading__primary">
        <TitleTag className="bb-display-title">
          {title}
        </TitleTag>
        {align === 'stacked' && lead && (
          <p className="bb-lead-paragraph">{lead}</p>
        )}
      </div>

      {align === 'split' && (lead || action) && (
        <div className="bb-section-heading__secondary">
          {lead && <p className="bb-lead-paragraph">{lead}</p>}
          {action && <div className="bb-heading-action">{action}</div>}
        </div>
      )}

      {align === 'center' && lead && (
        <p className="bb-lead-paragraph bb-lead-paragraph--center">{lead}</p>
      )}
    </div>
  );
}
