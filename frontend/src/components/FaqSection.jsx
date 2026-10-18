import React, { useState } from 'react';
import Container from './ui/Container.jsx';
import Section from './ui/Section.jsx';
import SectionIndex from './ui/SectionIndex.jsx';

/**
 * 6 Original Verified FAQ Items for Axon
 * Distinguishes implemented graph capabilities from simulated clusters and planned integrations.
 */
const FAQ_ITEMS = [
  {
    id: 'faq-1',
    question: 'What does Axon actually do?',
    answer: 'It links your company’s tickets, docs, people, systems and decisions into one graph, then lets an agent answer questions by following those links. You get an answer plus the exact path it took, so you can check it yourself.',
  },
  {
    id: 'faq-2',
    question: 'How does it find the root cause of a problem?',
    answer: 'It starts at the thing that’s failing (say, a campaign) and walks the graph to the nearest incident ticket it depends on, using a shortest-path Cypher query in FalkorDB. Each step of that path is shown in the lab so you can see why it reached that answer.',
  },
  {
    id: 'faq-3',
    question: 'Can I see why the agent decided something?',
    answer: 'Yes. Every answer lists the nodes and relationships it used, hop by hop, along with the Cypher query that produced them. If a hop isn’t in the graph, it isn’t in the answer.',
  },
  {
    id: 'faq-4',
    question: 'Who can see what?',
    answer: 'Permissions are checked on the graph before any data reaches the agent. Switch the role in the lab to “Sales” and ask about rider payouts: the query stops at the access boundary and returns a clear 403 instead of leaking the data.',
  },
  {
    id: 'faq-5',
    question: 'How does it catch outdated docs?',
    answer: 'When a decision replaces an older one (for example, the rain surcharge going from ₹30 to ₹50), the graph records a SUPERSEDES link. Any runbook or SLA still pointing at the old decision is flagged as stale.',
  },
  {
    id: 'faq-6',
    question: 'Is this connected to real systems?',
    answer: 'Not yet. The demo runs on a seeded quick-commerce company graph. With the FastAPI backend running it queries a live FalkorDB instance; without it, the site falls back to the same data in the browser so the demo always works.',
  },
];

/**
 * FaqSection
 * Implementation of Prompt 7 Part A:
 * - Small section number and uppercase monospace label
 * - Large editorial serif headline on the left
 * - Short introductory text on the right
 * - Full-width accordion list below
 * - Large question text and restrained plus/minus controls
 * - Thin dotted/dashed separators, generous vertical spacing
 * - Keyboard accessible with aria-expanded and aria-controls
 */
export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggleItem = (idx) => {
    setOpenIndex(openIndex === idx ? -1 : idx);
  };

  return (
    <Section className="bb-faq-section" id="faq" spacing="default">
      <Container className="bb-faq-container">
        {/* Section Index Header */}
        <div className="bb-faq-header-row">
          <SectionIndex number="05" label="FAQ" />
          <span className="bb-faq-header-tag">FREQUENTLY ASKED QUESTIONS</span>
        </div>

        {/* Two-Column Intro Lockup */}
        <div className="bb-faq-intro-grid">
          <div className="bb-faq-intro-left">
            <h2 className="bb-faq-headline">
              Questions people<br />
              <span className="bb-headline-italic">usually ask.</span>
            </h2>
          </div>

          <div className="bb-faq-intro-right">
            <p className="bb-faq-intro-copy">
              Short answers about what the demo does, how the graph works, and what’s real
              versus simulated.
            </p>
          </div>
        </div>

        {/* Full-Width Accordion List */}
        <div className="bb-faq-accordion" role="region" aria-label="Frequently Asked Questions List">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={item.id}
                className={`bb-faq-item ${isOpen ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  id={`faq-btn-${idx}`}
                  className="bb-faq-question-btn"
                  onClick={() => toggleItem(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span className="bb-faq-question-text">{item.question}</span>
                  <span className="bb-faq-toggle-icon" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    className="bb-faq-answer-panel"
                    role="region"
                    aria-labelledby={`faq-btn-${idx}`}
                  >
                    <p className="bb-faq-answer-text">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
