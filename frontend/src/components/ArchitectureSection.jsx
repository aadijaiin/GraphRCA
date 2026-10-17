import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, CalendarDays, ClipboardList, Database, FileText, GitBranch, MessageSquare,
} from 'lucide-react';
import Container from './ui/Container.jsx';
import Section from './ui/Section.jsx';
import SectionIndex from './ui/SectionIndex.jsx';
import CornerTicks from './ui/CornerTicks.jsx';

const SOURCES = [
  { icon: ClipboardList, label: 'Tickets' },
  { icon: FileText, label: 'Runbooks' },
  { icon: MessageSquare, label: 'Chats' },
  { icon: GitBranch, label: 'Code' },
  { icon: Database, label: 'Orders DB' },
  { icon: Activity, label: 'Sensors' },
  { icon: CalendarDays, label: 'Campaigns' },
];

const STEPS = [
  {
    kicker: '01 · TODAY',
    title: 'The knowledge lives in people’s heads.',
    body: 'Your team on one side, the systems customers feel on the other. In between sit tickets, runbooks and chats that nobody can search all at once.',
  },
  {
    kicker: '02 · THE GRAPH',
    title: 'Connect it into one graph.',
    body: 'BlinkBrain reads tickets, runbooks, chats, code and orders, then links them in FalkorDB: who owns what, what depends on what, and which decision replaced which.',
  },
  {
    kicker: '03 · THE AGENTS',
    title: 'Agents that walk the graph.',
    body: 'They find causes, route owners and flag stale docs, and every answer shows its path. If your role can’t see a node, the agent stops there.',
  },
];

/** Original BlinkBrain mark for the agents tile: a rising dot lattice. */
function AgentsMark() {
  const dots = [[4, 0], [3, 1], [5, 1], [2, 2], [4, 2], [6, 2], [1, 3], [3, 3], [5, 3], [0, 4]];
  return (
    <svg className="bb-stack-mark" viewBox="0 0 70 50" aria-hidden="true">
      {dots.map(([x, y], i) => (
        <circle key={i} cx={6 + x * 9.6} cy={6 + y * 9.6} r={4.2} className={i === 0 ? 'bb-stack-mark-hot' : ''} />
      ))}
    </svg>
  );
}

function StackLayer({ title, detail, spec, className = '', reveal, children }) {
  return (
    <div className={`bb-stack-layer ${className}`.trim()} data-reveal={reveal}>
      <CornerTicks size={7} />
      <div className="bb-stack-layer-copy">
        {spec && <span className="bb-stack-spec">{spec}</span>}
        <h3 className="bb-stack-title">{title}</h3>
        <p className="bb-stack-detail">{detail}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * StackDiagram
 * Oblique dashed-wireframe stack. The final layout is always reserved, so nothing
 * reflows; each piece carries a data-reveal window ("start,end,dir") that the
 * section scrubs against scroll progress. Order: team → operations → sources
 * (one by one) → company graph → agents → mark.
 */
export const StackDiagram = React.forwardRef(function StackDiagram(_, ref) {
  return (
    <div
      ref={ref}
      className="bb-stack-frame"
      role="img"
      aria-label="BlinkBrain stack: your team, BlinkBrain agents, the company graph in FalkorDB, connected sources, and day-to-day operations"
    >
      <div className="bb-stack">
        <StackLayer reveal="0,0.1,up" title="Your team" detail="Asks questions and makes the final call." spec="ROLES · APPROVALS" />
        <div className="bb-stack-split">
          <div className="bb-stack-split-main">
            <StackLayer reveal="0.72,0.82,down" title="BlinkBrain agents" detail="Find causes, route owners, flag stale docs." spec="TRACE · DELEGATE · DRIFT · ACCESS" />
            <StackLayer reveal="0.52,0.62,up" title="Company graph" detail="People, systems, docs and decisions, all connected." spec="FALKORDB · CYPHER" />
          </div>
          <div className="bb-stack-tile bb-stack-tile--mark" data-reveal="0.8,0.92,down">
            <CornerTicks size={7} />
            <AgentsMark />
          </div>
        </div>
        <div className="bb-stack-sources">
          {SOURCES.map(({ icon: Icon, label }, i) => (
            <div className="bb-stack-tile" key={label} data-reveal={`${0.24 + i * 0.03},${0.32 + i * 0.03},up`}>
              <CornerTicks size={6} />
              <Icon size={22} strokeWidth={1.6} />
              <span>{label}</span>
            </div>
          ))}
          <div className="bb-stack-tile bb-stack-tile--more" data-reveal={`${0.24 + SOURCES.length * 0.03},${0.32 + SOURCES.length * 0.03},up`}>
            <CornerTicks size={6} />
            <span>+ your tools</span>
          </div>
        </div>
        <StackLayer reveal="0.06,0.16,up" title="Operations" detail="Dark stores, riders, pricing and checkout." spec="WHAT CUSTOMERS FEEL" />
      </div>
    </div>
  );
});

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export default function ArchitectureSection() {
  const [activeStep, setActiveStep] = useState(0);
  const scrollyRef = useRef(null);
  const diagramRef = useRef(null);

  useEffect(() => {
    const scrolly = scrollyRef.current;
    const diagram = diagramRef.current;
    if (!scrolly || !diagram) return undefined;
    const items = [...diagram.querySelectorAll('[data-reveal]')].map((el) => {
      const [start, end, dir] = el.dataset.reveal.split(',');
      return { el, start: Number(start), end: Number(end), dir };
    });
    const staticQuery = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 960px)');
    let lastStep = -1;

    // Scroll events already fire at most once per frame, so update directly
    function apply() {
      let progress = 1;
      if (!staticQuery.matches) {
        const rect = scrolly.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 when the section top reaches 65% of the viewport, 1 near its end
        progress = Math.min(1, Math.max(0, (vh * 0.65 - rect.top) / Math.max(1, rect.height - vh * 0.75)));
      }
      items.forEach(({ el, start, end, dir }) => {
        const t = easeOut(Math.min(1, Math.max(0, (progress - start) / (end - start))));
        const offset = (1 - t) * (dir === 'down' ? -46 : 46);
        el.style.opacity = String(t);
        el.style.transform = t >= 1 ? '' : `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      const step = progress < 0.42 ? 0 : progress < 0.68 ? 1 : 2;
      if (step !== lastStep) {
        lastStep = step;
        setActiveStep(step);
      }
    }

    apply();
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    staticQuery.addEventListener?.('change', apply);
    return () => {
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      staticQuery.removeEventListener?.('change', apply);
    };
  }, []);

  return (
    <Section className="bb-architecture-section" id="architecture" spacing="default">
      <Container className="bb-architecture-container">
        <div className="bb-arch-header-row">
          <SectionIndex number="02" label="HOW IT WORKS" />
          <span className="bb-arch-header-sub">ONE GRAPH UNDER EVERYTHING</span>
        </div>

        <div className="bb-arch-scrolly" ref={scrollyRef}>
          <div className="bb-arch-steps">
            {STEPS.map((step, i) => (
              <article
                key={step.kicker}
                className={`bb-arch-step ${activeStep === i ? 'is-active' : ''}`}
              >
                <CornerTicks size={9} />
                <span className="bb-arch-step-kicker">{step.kicker}</span>
                <h2 className="bb-arch-step-title">{step.title}</h2>
                <p className="bb-arch-step-body">{step.body}</p>
              </article>
            ))}
          </div>

          <div className="bb-arch-sticky">
            <StackDiagram ref={diagramRef} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
