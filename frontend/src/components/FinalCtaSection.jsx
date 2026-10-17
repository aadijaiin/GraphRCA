import React from 'react';
import Button from './ui/Button.jsx';

/**
 * FinalCtaSection
 * Full-bleed dark grain panel with a centered serif headline,
 * a cream primary pill and a quiet text link.
 */
export default function FinalCtaSection({ onLaunchDemo }) {
  return (
    <section className="bb-final-cta-section bb-final-cta-dark" id="cta" aria-labelledby="bb-cta-headline">
      <div className="bb-final-cta-grain" aria-hidden="true" />
      <div className="bb-final-cta-inner">
        <h2 className="bb-cta-headline" id="bb-cta-headline">
          The explainable brain for <span className="bb-headline-italic">quick commerce</span>.
        </h2>

        <p className="bb-cta-body">
          Open the live lab to watch a freezer outage trace itself
          <br className="bb-cta-break" /> back to the campaign it broke.
        </p>

        <div className="bb-cta-button-row">
          <Button
            variant="primary"
            size="md"
            className="bb-btn--cream"
            onClick={() => {
              if (onLaunchDemo) onLaunchDemo('rootcause');
            }}
            ariaLabel="Launch the demo in Explainability Lab"
          >
            Launch the demo
          </Button>

          <a href="#research" className="bb-cta-text-link">Read the research</a>
        </div>
      </div>
    </section>
  );
}
