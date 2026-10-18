import React from 'react';
import CornerTicks from './ui/CornerTicks.jsx';
import { AxonSymbol } from './Navbar.jsx';

/**
 * Footer
 * Light editorial footer: four corner-ticked columns with mono headings and
 * serif links, plus a status column carrying the live graph badge.
 */
export default function Footer({ onLaunchDemo }) {
  const launch = (scenario) => {
    if (onLaunchDemo) onLaunchDemo(scenario);
  };

  return (
    <footer className="bb-footer" role="contentinfo">
      <div className="bb-footer-grid">
        <div className="bb-footer-col">
          <CornerTicks size={8} />
          <span className="bb-footer-nav-heading">PRODUCT</span>
          <ul className="bb-footer-nav-list">
            <li><a href="#architecture">Architecture</a></li>
            <li><a href="#agents">Agents</a></li>
            <li><a href="#product-preview">Company Graph</a></li>
          </ul>
        </div>

        <div className="bb-footer-col">
          <CornerTicks size={8} />
          <span className="bb-footer-nav-heading">RESOURCES</span>
          <ul className="bb-footer-nav-list">
            <li><a href="#research">Research</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#complexity">The Gap</a></li>
          </ul>
        </div>

        <div className="bb-footer-col">
          <CornerTicks size={8} />
          <span className="bb-footer-nav-heading">LAB</span>
          <ul className="bb-footer-nav-list">
            <li><button type="button" className="bb-footer-action-link" onClick={() => launch('rootcause')}>Root cause</button></li>
            <li><button type="button" className="bb-footer-action-link" onClick={() => launch('surge')}>Surge drift</button></li>
            <li><button type="button" className="bb-footer-action-link" onClick={() => launch('access')}>Access policy</button></li>
          </ul>
        </div>

        <div className="bb-footer-col bb-footer-col--status">
          <CornerTicks size={8} />
          <div className="bb-footer-badges">
            <span className="bb-footer-status-badge" title="FalkorDB Graph Engine Live">
              <span className="bb-footer-dot-live" />
              <span className="bb-footer-status-label">ALL GRAPHS HEALTHY</span>
            </span>
            <span className="bb-footer-plain-badge">WE MAKE DEVS · 2026</span>
          </div>
          <div className="bb-footer-brand-wrap">
            <span className="bb-footer-tagline">
              The explainable company brain for quick-commerce production. FalkorDB · Cypher · React.
            </span>
            <AxonSymbol size={44} />
          </div>
        </div>
      </div>
    </footer>
  );
}
