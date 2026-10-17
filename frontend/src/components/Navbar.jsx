import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ArrowUpRight, ShieldCheck, ChevronRight } from 'lucide-react';

/**
 * Original BlinkBrain Brand Glyph Symbol
 * A restrained technical graph constellation with an active orange hub.
 */
export function BlinkBrainSymbol({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="bb-brand-glyph-svg"
    >
      {/* Background container */}
      <rect width="24" height="24" rx="6" fill="#171513" />
      {/* Network Edges */}
      <line x1="6.5" y1="12" x2="12" y2="6.5" stroke="#F5F4ED" strokeWidth="1.4" strokeOpacity="0.4" />
      <line x1="12" y1="6.5" x2="17.5" y2="12" stroke="#F5F4ED" strokeWidth="1.4" strokeOpacity="0.4" />
      <line x1="6.5" y1="12" x2="17.5" y2="12" stroke="#F26B32" strokeWidth="1.4" strokeOpacity="0.6" />
      <line x1="12" y1="6.5" x2="12" y2="17.5" stroke="#F5F4ED" strokeWidth="1.4" strokeOpacity="0.4" />
      <line x1="6.5" y1="12" x2="12" y2="17.5" stroke="#F5F4ED" strokeWidth="1.4" strokeOpacity="0.4" />
      <line x1="17.5" y1="12" x2="12" y2="17.5" stroke="#F26B32" strokeWidth="1.4" strokeOpacity="0.6" />
      {/* Network Nodes */}
      <circle cx="12" cy="6.5" r="2.2" fill="#F5F4ED" />
      <circle cx="6.5" cy="12" r="2.2" fill="#F5F4ED" />
      <circle cx="17.5" cy="12" r="2.6" fill="#F26B32" />
      <circle cx="12" cy="17.5" r="2.2" fill="#F5F4ED" />
      {/* Center Hub */}
      <circle cx="12" cy="12" r="1.6" fill="#F5F4ED" />
    </svg>
  );
}

/**
 * Editorial Navbar Component
 * 1. Sticky frosted capsules floating over the canvas (no status strip)
 * 2. Left-aligned navigation capsule
 * 3. Centered brand capsule with symbol and wordmark
 * 4. Right-aligned group with secondary link and dark "Launch demo" CTA
 */
export default function Navbar({ onLaunchDemo }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef(null);

  // Close mobile menu on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { label: 'Architecture', href: '#architecture' },
    { label: 'Agent Workflow', href: '#agent-workflow' },
    { label: 'Research', href: '#research' },
    { label: 'FAQ', href: '#faq' },
  ];

  const handleDemoClick = (scenario = 'rootcause') => {
    setMobileMenuOpen(false);
    if (onLaunchDemo) {
      onLaunchDemo(scenario);
    }
  };

  return (
    <header className="bb-navbar-header" ref={navRef}>
      {/* =========================================================
          2. FLOATING / STICKY THREE-PART CAPSULES
          ========================================================= */}
      <nav className="bb-navbar-bar" aria-label="Primary navigation">
        <div className="bb-navbar-container">
          {/* Left-Aligned Rounded Navigation Capsule */}
          <div className="bb-nav-capsule bb-nav-capsule--left">
            <ul className="bb-nav-links" role="list">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="bb-nav-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Centered Brand Capsule */}
          <div className="bb-nav-capsule bb-nav-capsule--center">
            <a href="#" className="bb-brand-lockup" aria-label="BlinkBrain Home">
              <BlinkBrainSymbol size={22} />
              <span className="bb-brand-wordmark">BlinkBrain</span>
            </a>
          </div>

          {/* Right Group: Actions Capsule + Mobile Menu Toggle */}
          <div className="bb-nav-right-group">
            <div className="bb-nav-capsule bb-nav-capsule--right">
              <button
                type="button"
                className="bb-nav-secondary-btn"
                onClick={() => handleDemoClick('rootcause')}
                aria-label="Sign In to BlinkBrain"
              >
                Sign In
              </button>
              <button
                type="button"
                className="bb-nav-cta-btn"
                onClick={() => handleDemoClick('rootcause')}
                aria-label="Launch BlinkBrain demo"
              >
                <span>Launch demo</span>
              </button>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className="bb-mobile-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="bb-mobile-nav-panel"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            id="bb-mobile-nav-panel"
            className="bb-mobile-nav-panel"
            role="dialog"
            aria-label="Mobile navigation menu"
          >
            <ul className="bb-mobile-links" role="list">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="bb-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>{link.label}</span>
                    <ChevronRight size={14} className="bb-mobile-chevron" />
                  </a>
                </li>
              ))}
            </ul>

            <div className="bb-mobile-actions">
              <button
                type="button"
                className="bb-mobile-secondary-btn"
                onClick={() => handleDemoClick('rootcause')}
              >
                Sign In
              </button>
              <button
                type="button"
                className="bb-mobile-cta-btn"
                onClick={() => handleDemoClick('rootcause')}
              >
                Launch demo
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
