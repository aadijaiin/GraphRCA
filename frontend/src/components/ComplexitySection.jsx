import React from "react";
import Container from "./ui/Container.jsx";
import Section from "./ui/Section.jsx";
import CornerTicks from "./ui/CornerTicks.jsx";
import SectionIndex from "./ui/SectionIndex.jsx";

/**
 * TechnicalComplexitySvg
 * Responsive vector diagram of the "Representational Gap":
 * - Thin grey horizontal & vertical axes with fine ticks
 * - Dotted construction lines
 * - Vertical "COMPLEXITY" and horizontal "TIME" labels
 * - Accelerating orange curve (#F26B32): operational complexity
 * - Flatter olive curve (#A99B16): human cognitive capacity
 * - Tinted representational gap fill
 * - Vertical double-headed arrow spanning the gap
 * - Dark pill badge: "REPRESENTATIONAL GAP"
 * - Pale annotation boxes:
 *   - "UNDERSTANDING NEEDED TO MANAGE PRODUCTION"
 *   - "WHAT YOUR TEAM CAN HOLD IN THEIR HEADS"
 */
export function TechnicalComplexitySvg() {
  return (
    <div className="bb-complexity-diagram-frame">
      <CornerTicks strokeColor="rgba(23, 21, 19, 0.4)" size={9} />

      <svg
        className="bb-complexity-svg"
        viewBox="0 0 680 480"
        role="img"
        aria-label="Graph of Operational Complexity vs Human Cognitive Capacity showing the Representational Gap"
      >
        <defs>
          {/* Subtle gradient fill for the Representational Gap area */}
          <linearGradient id="bbGapFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F26B32" stopOpacity="0.02" />
            <stop offset="45%" stopColor="#F26B32" stopOpacity="0.07" />
            <stop offset="90%" stopColor="#F26B32" stopOpacity="0.13" />
          </linearGradient>

          {/* Upward arrow marker */}
          <marker
            id="bbArrowUp"
            viewBox="0 0 8 8"
            refX="4"
            refY="2"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <polygon points="0,7 4,1 8,7" fill="#171513" />
          </marker>

          {/* Downward arrow marker */}
          <marker
            id="bbArrowDown"
            viewBox="0 0 8 8"
            refX="4"
            refY="6"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <polygon points="0,1 4,7 8,1" fill="#171513" />
          </marker>
        </defs>

        {/* Subtle Horizontal Dotted Construction Lines */}
        <g className="bb-chart-construction-lines" opacity="0.6">
          <line
            x1="90"
            y1="110"
            x2="635"
            y2="110"
            stroke="#171513"
            strokeWidth="1"
            strokeDasharray="2 5"
            strokeOpacity="0.12"
          />
          <line
            x1="90"
            y1="210"
            x2="635"
            y2="210"
            stroke="#171513"
            strokeWidth="1"
            strokeDasharray="2 5"
            strokeOpacity="0.12"
          />
          <line
            x1="90"
            y1="310"
            x2="635"
            y2="310"
            stroke="#171513"
            strokeWidth="1"
            strokeDasharray="2 5"
            strokeOpacity="0.12"
          />
          {/* Vertical dashed evaluation line where the gap is measured */}
          <line
            x1="550"
            y1="55"
            x2="550"
            y2="420"
            stroke="#171513"
            strokeWidth="1"
            strokeDasharray="3 4"
            strokeOpacity="0.16"
          />
        </g>

        {/* Shaded Area of the Representational Gap */}
        <path
          d="M 90 405 C 240 395, 380 290, 550 95 L 635 55 L 635 360 L 550 365 C 380 375, 240 388, 90 405 Z"
          fill="url(#bbGapFill)"
        />

        {/* Axes Lines */}
        {/* Y-Axis: Complexity */}
        <line
          x1="90"
          y1="40"
          x2="90"
          y2="420"
          stroke="#171513"
          strokeWidth="1.4"
          strokeOpacity="0.4"
        />
        {/* X-Axis: Time */}
        <line
          x1="90"
          y1="420"
          x2="655"
          y2="420"
          stroke="#171513"
          strokeWidth="1.4"
          strokeOpacity="0.4"
        />

        {/* Ticks along Y-Axis (Complexity) */}
        <g className="bb-chart-ticks-y" stroke="#171513" strokeOpacity="0.35">
          <line x1="82" y1="110" x2="90" y2="110" strokeWidth="1.4" />
          <line x1="85" y1="160" x2="90" y2="160" strokeWidth="1" />
          <line x1="82" y1="210" x2="90" y2="210" strokeWidth="1.4" />
          <line x1="85" y1="260" x2="90" y2="260" strokeWidth="1" />
          <line x1="82" y1="310" x2="90" y2="310" strokeWidth="1.4" />
          <line x1="85" y1="360" x2="90" y2="360" strokeWidth="1" />
        </g>

        {/* Ticks along X-Axis (Time) */}
        <g className="bb-chart-ticks-x" stroke="#171513" strokeOpacity="0.35">
          {[150, 210, 270, 330, 390, 450, 510, 570, 630].map((x, i) => (
            <line
              key={`x-tick-${x}`}
              x1={x}
              y1={420}
              x2={x}
              y2={i % 2 === 0 ? 428 : 425}
              strokeWidth={i % 2 === 0 ? 1.4 : 1}
            />
          ))}
        </g>

        {/* Axes Labels */}
        <text
          x="90"
          y="28"
          fontFamily="var(--font-mono, 'DM Mono', monospace)"
          fontSize="10.5px"
          fontWeight="600"
          letterSpacing="0.08em"
          fill="#171513"
          fillOpacity="0.75"
        >
          COMPLEXITY
        </text>

        <text
          x="655"
          y="438"
          textAnchor="end"
          fontFamily="var(--font-mono, 'DM Mono', monospace)"
          fontSize="10.5px"
          fontWeight="600"
          letterSpacing="0.08em"
          fill="#171513"
          fillOpacity="0.75"
        >
          TIME →
        </text>

        {/* Slower Olive Curve: Human Cognitive Capacity */}
        <path
          d="M 90 405 C 240 388, 380 375, 550 365 L 635 360"
          fill="none"
          stroke="#A99B16"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="635" cy="360" r="4.5" fill="#A99B16" />

        {/* Accelerating Orange Curve: Growing Operational Complexity */}
        <path
          d="M 90 405 C 240 395, 380 290, 550 95 L 635 55"
          fill="none"
          stroke="#F26B32"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="635" cy="55" r="4.5" fill="#F26B32" />

        {/* Vertical Double-Headed Arrow between the Curves */}
        <g className="bb-chart-gap-arrow">
          <line
            x1="550"
            y1="112"
            x2="550"
            y2="348"
            stroke="#171513"
            strokeWidth="1.4"
            strokeDasharray="3 3"
          />
          {/* Arrow heads */}
          <polygon points="546,120 550,106 554,120" fill="#171513" />
          <polygon points="546,340 550,354 554,340" fill="#171513" />
        </g>

        {/* Top Pale Annotation Box: UNDERSTANDING NEEDED TO MANAGE PRODUCTION */}
        <g className="bb-chart-annotation bb-chart-annotation--top">
          {/* Fine leader tick connecting to upper curve */}
          <line
            x1="310"
            y1="84"
            x2="330"
            y2="128"
            stroke="#F26B32"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.6"
          />
          <rect
            x="150"
            y="60"
            width="310"
            height="26"
            rx="4"
            fill="#F5F4ED"
            stroke="rgba(23, 21, 19, 0.22)"
            strokeWidth="1"
          />
          <circle cx="166" cy="73" r="3.5" fill="#F26B32" />
          <text
            x="178"
            y="77"
            fontFamily="var(--font-mono, 'DM Mono', monospace)"
            fontSize="9px"
            fontWeight="600"
            letterSpacing="0.05em"
            fill="#171513"
          >
            UNDERSTANDING NEEDED TO MANAGE PRODUCTION
          </text>
        </g>

        {/* Bottom Pale Annotation Box: WHAT YOUR TEAM CAN HOLD IN THEIR HEADS */}
        <g className="bb-chart-annotation bb-chart-annotation--bottom">
          {/* Fine leader tick connecting to lower curve */}
          <line
            x1="300"
            y1="384"
            x2="320"
            y2="350"
            stroke="#A99B16"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.6"
          />
          <rect
            x="170"
            y="384"
            width="270"
            height="26"
            rx="4"
            fill="#F5F4ED"
            stroke="rgba(23, 21, 19, 0.22)"
            strokeWidth="1"
          />
          <circle cx="186" cy="397" r="3.5" fill="#A99B16" />
          <text
            x="198"
            y="401"
            fontFamily="var(--font-mono, 'DM Mono', monospace)"
            fontSize="9px"
            fontWeight="600"
            letterSpacing="0.05em"
            fill="#171513"
          >
            WHAT YOUR TEAM CAN HOLD IN THEIR HEADS
          </text>
        </g>

        {/* Black Center Annotation Badge: REPRESENTATIONAL GAP */}
        <g className="bb-chart-annotation bb-chart-annotation--gap">
          <rect
            x="465"
            y="218"
            width="170"
            height="26"
            rx="13"
            fill="#171513"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="1"
          />
          <text
            x="550"
            y="235"
            textAnchor="middle"
            fontFamily="var(--font-mono, 'DM Mono', monospace)"
            fontSize="9.5px"
            fontWeight="700"
            letterSpacing="0.07em"
            fill="#F5F4ED"
          >
            REPRESENTATIONAL GAP
          </text>
        </g>
      </svg>
    </div>
  );
}

/**
 * ComplexitySection
 * Full implementation of Prompt 3:
 * - Spacious two-column layout (Technical SVG diagram + large editorial serif copy)
 * - Original Axon editorial text covering:
 *   1. Quick-commerce represented across many disconnected systems
 *   2. Knowledge fragmentation across tickets, inventory, pricing, campaigns, docs, people
 *   3. Dashboards showing symptoms rather than cross-department causes
 *   4. Connected company graph providing relationship context
 * - Editorial drop cap initial with corner ticks
 * - Short rhythmic concluding cadence: "It connects. It traces. It explains. It learns."
 * - Restrained research-report bottom strip with section index and technical metadata
 * - Responsive layout stacking gracefully on mobile
 */
export default function ComplexitySection() {
  return (
    <Section
      className="bb-complexity-section"
      id="complexity"
      spacing="default"
    >
      <Container className="bb-complexity-container">
        <div className="bb-arch-header-row">
          <SectionIndex number="01" label="THE GAP" />
          <span className="bb-arch-header-sub">
            WHY DASHBOARDS AREN'T ENOUGH
          </span>
        </div>

        <div className="bb-complexity-grid">
          {/* Left Column: Responsive Custom Technical Complexity Chart */}
          <div className="bb-complexity-diagram-col">
            <TechnicalComplexitySvg />
          </div>

          {/* Right Column: Large Editorial Serif Copy */}
          <div className="bb-complexity-text-col">
            {/* Lead paragraph with large typographic initial */}
            <p className="bb-complexity-lead">
              <span className="bb-drop-cap-box">
                <span className="bb-drop-cap-char">A</span>
                <CornerTicks size={8} strokeColor="rgba(23, 21, 19, 0.35)" />
              </span>
              10-minute delivery company runs on dozens of separate systems:
              inventory, freezers, pricing, riders, campaigns. They all change
              at once, and none of them talk to each other.
            </p>

            <p className="bb-complexity-body">
              The knowledge that ties them together is scattered across tickets,
              old runbooks and whoever happens to be on call. Nobody can hold
              the whole picture in their head.
            </p>

            <p className="bb-complexity-body">
              So when something breaks, dashboards show <em>that</em> orders are
              failing, not
              <em> why</em>. Was it a price change, a freezer, a stale doc?
              Teams spend the incident guessing.
            </p>

            <p className="bb-complexity-body">
              Axon closes that gap with one connected graph of the company, and
              an agent that can follow it.
            </p>

            <p className="bb-complexity-cadence">
              It connects. It traces. It explains.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
