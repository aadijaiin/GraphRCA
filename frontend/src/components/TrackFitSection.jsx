import React from 'react';
import { ArrowRight } from 'lucide-react';
import Container from './ui/Container.jsx';
import Section from './ui/Section.jsx';
import CornerTicks from './ui/CornerTicks.jsx';

/**
 * TrackFitSection
 * Maps each Graph Hacks · Track 03 (Company Brain) focus area to what Axon
 * does, in plain words, with the underlying graph pattern for technical readers
 * and a button that opens the matching live scenario in /app.
 */
const FOCUS = [
  {
    focus: 'Docs, tickets and chats in one graph',
    title: 'Everything lands in one graph',
    body: 'Runbooks, tickets and team threads become nodes, linked to the systems and people they mention.',
    pattern: '(:Doc)-[:DOCUMENTS]->(:System)<-[:MODIFIES]-(:Ticket)',
    scenario: 'rootcause',
    cta: 'See the graph',
  },
  {
    focus: 'Who owns what, and who knows what',
    title: 'It knows who to call',
    body: 'A new P0 goes to the engineer who fixed the last similar bug, not whoever is on top of the rota.',
    pattern: '(:Person)-[:RESOLVED]->(:Ticket)-[:MODIFIES]->(:System)',
    scenario: 'checkout',
    cta: 'Route a P0',
  },
  {
    focus: 'Tracing decisions back to their source',
    title: 'Every answer shows its path',
    body: 'Ask why a campaign is failing and get the step-by-step chain back to the freezer outage ticket.',
    pattern: 'shortestPath((:Person)-[*..6]-(:Ticket))',
    scenario: 'rootcause',
    cta: 'Trace a cause',
  },
  {
    focus: 'Keeping knowledge current as things change',
    title: 'It notices stale docs',
    body: 'When the rain surcharge rule goes from ₹30 to ₹50, every doc still promising ₹30 gets flagged.',
    pattern: '(:Decision)-[:SUPERSEDES]->(:Decision)<-[:REFERENCES]-(:Doc)',
    scenario: 'surge',
    cta: 'Find stale docs',
  },
  {
    focus: 'Answers with clear sources',
    title: 'Sources shown, access respected',
    body: 'Answers cite the exact nodes they used, and stop with a clear 403 when your role can’t see the data.',
    pattern: 'RBAC check on every hop, before data reaches the model',
    scenario: 'access',
    cta: 'Test access',
  },
];

export default function TrackFitSection({ onLaunchDemo }) {
  return (
    <Section className="bb-track-section" id="track" spacing="default">
      <Container className="bb-track-container">
        <div className="bb-track-grid">
          <div className="bb-track-intro">
            <span className="bb-track-kicker">GRAPH HACKS · TRACK 03 · COMPANY BRAIN</span>
            <h2 className="bb-track-headline">
              Built for the <span className="bb-headline-italic">Company Brain</span> track.
            </h2>
            <p className="bb-track-lede">
              The track asks for an agent that understands how a company works. Here is each part
              of the brief, what Axon does about it, and a live demo you can open.
            </p>
            <p className="bb-track-note">
              Powered by FalkorDB. Each dark code line is the shape of the Cypher query the agent runs.
            </p>
          </div>

          <ol className="bb-track-list">
            {FOCUS.map((item, i) => (
              <li className="bb-track-item" key={item.focus}>
                <CornerTicks size={7} />
                <span className="bb-track-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="bb-track-copy">
                  <span className="bb-track-focus">{item.focus}</span>
                  <h3 className="bb-track-title">{item.title}</h3>
                  <p className="bb-track-body">{item.body}</p>
                  <code className="bb-track-pattern">{item.pattern}</code>
                </div>
                <button
                  type="button"
                  className="bb-track-cta"
                  onClick={() => onLaunchDemo?.(item.scenario)}
                  aria-label={`${item.cta}: open the ${item.scenario} demo`}
                >
                  {item.cta} <ArrowRight size={13} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
