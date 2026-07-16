import Link from 'next/link';
import {
  Server,
  Shield,
  Radio,
  Wrench,
  MessageSquare,
  Puzzle,
  ArrowRight,
  Github,
  ChevronRight,
} from 'lucide-react';

const features = [
  {
    icon: Server,
    title: 'Multi-Server',
    description: 'Connect to multiple MCP servers at once. One unified interface for all your integrations.',
  },
  {
    icon: Shield,
    title: 'OAuth 2.0 & PKCE',
    description: 'Secure auth with automatic token refresh, PKCE support, and dynamic client registration.',
  },
  {
    icon: Radio,
    title: 'Real-time Streaming',
    description: 'SSE and Streamable HTTP transports for live updates and bi-directional communication.',
  },
  {
    icon: Wrench,
    title: 'Full Protocol',
    description: 'Tools, resources, prompts, sampling, elicitation, progress, logging — the complete spec.',
  },
  {
    icon: MessageSquare,
    title: 'LLM Chat',
    description: 'Built-in chat with configurable AI providers. Tools from all servers in one conversation.',
  },
  {
    icon: Puzzle,
    title: '50+ Integrations',
    description: 'Pre-configured servers for Notion, Stripe, Vercel, Figma, HubSpot and more.',
  },
];

const integrations = [
  { name: 'Notion', category: 'productivity' },
  { name: 'Linear', category: 'productivity' },
  { name: 'Stripe', category: 'finance' },
  { name: 'Vercel', category: 'developer' },
  { name: 'Cloudflare', category: 'developer' },
  { name: 'Sentry', category: 'developer' },
  { name: 'Figma', category: 'design' },
  { name: 'HubSpot', category: 'marketing' },
  { name: 'PayPal', category: 'finance' },
  { name: 'PubMed', category: 'research' },
  { name: 'Atlassian', category: 'developer' },
  { name: 'Canva', category: 'design' },
  { name: 'Asana', category: 'productivity' },
  { name: 'Square', category: 'finance' },
  { name: 'Box', category: 'productivity' },
  { name: 'Intercom', category: 'marketing' },
];

const steps = [
  {
    number: '01',
    title: 'Add a server',
    description: 'Enter a URL or choose from 50+ pre-configured integrations.',
  },
  {
    number: '02',
    title: 'Authenticate',
    description: 'OAuth 2.0, bearer tokens, or no auth. PKCE handled automatically.',
  },
  {
    number: '03',
    title: 'Start building',
    description: 'Browse tools, read resources, use prompts, and chat with LLMs.',
  },
];

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', minHeight: '100vh', overflowX: 'hidden' }}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4" style={{ background: 'var(--color-accent)', color: 'var(--color-paper)' }}>Skip to content</a>

      {/* Nav — N9 Edge-aligned minimal */}
      <nav className="landing-nav" aria-label="Main">
        <span className="landing-nav-wordmark">MCPHost</span>
        <Link href="/dashboard" className="landing-nav-cta">
          Launch App <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
        </Link>
      </nav>

      <main id="main-content">
        {/* Hero — left-biased, functional, not showy */}
        <section className="landing-hero hero-enter">
          {/* Status badge */}
          <div className="landing-badge">
            <span className="landing-badge-dot pulse-glow" aria-hidden="true" />
            <span>Open Source · MIT</span>
          </div>

          {/* Headline — solid ink, no gradient */}
          <h1 className="landing-headline">
            The universal client for Model Context Protocol.
          </h1>

          {/* Subtitle */}
          <p className="landing-subtitle">
            Connect to any MCP server from your browser. Browse tools, read resources,
            use prompts, and chat with LLMs — all in one place.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', alignItems: 'center' }}>
            <Link href="/dashboard" className="cta-primary">
              Launch App <ArrowRight style={{ width: '1rem', height: '1rem' }} />
            </Link>
            <a
              href="https://github.com/hemanth/mcp-web-client"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-secondary"
            >
              <Github style={{ width: '1rem', height: '1rem' }} />
              View Source
            </a>
          </div>

          {/* Tech pills */}
          <div className="tech-pills">
            {['Next.js', 'TypeScript', 'MCP 2025-06-18', 'OAuth 2.0'].map((tech) => (
              <span key={tech} className="tech-pill">{tech}</span>
            ))}
          </div>
        </section>

        {/* Features — F3 Tabular spec sheet */}
        <section className="landing-section content-auto">
          <h2 className="landing-section-heading">What&apos;s inside</h2>
          <div className="features-grid">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className={`feature-item${i < 2 ? ' feature-item--wide' : ''}`}>
                  <div className="feature-title">
                    <Icon aria-hidden="true" />
                    <span>{feature.title}</span>
                  </div>
                  <p className="feature-desc">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Integrations */}
        <section className="landing-section content-auto">
          <h2 className="landing-section-heading">50+ integrations, ready to connect.</h2>
          <div className="integration-pills">
            {integrations.map((integration) => (
              <span
                key={integration.name}
                className={`integration-pill integration-pill--${integration.category}`}
              >
                {integration.name}
              </span>
            ))}
          </div>
          <Link href="/dashboard" className="browse-link">
            Browse all integrations <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
          </Link>
        </section>

        {/* How it works — horizontal flow */}
        <section className="landing-section content-auto">
          <h2 className="landing-section-heading">Three steps. Under a minute.</h2>
          <div className="steps-flow">
            {steps.map((step, i) => (
              <>
                <div key={step.number} className="step-item">
                  <span className="step-number">{step.number}</span>
                  <span className="step-title">{step.title}</span>
                  <span className="step-desc">{step.description}</span>
                </div>
                {i < steps.length - 1 && (
                  <div key={`connector-${i}`} className="step-connector" aria-hidden="true" />
                )}
              </>
            ))}
          </div>
        </section>

        {/* CTA — left-aligned, contained */}
        <section className="landing-cta-section">
          <h2 className="landing-cta-heading">Ready to connect?</h2>
          <p className="landing-cta-body">
            Launch the app and start connecting to MCP servers in seconds. No account required.
          </p>
          <Link href="/dashboard" className="cta-primary">
            Launch MCPHost <ArrowRight style={{ width: '1rem', height: '1rem' }} />
          </Link>
        </section>

        {/* Footer — Ft2 Inline rule single line */}
        <footer className="landing-footer">
          <div className="landing-footer-inner">
            <span className="footer-wordmark">MCPHost</span>
            <span aria-hidden="true">·</span>
            <span>Open Source MCP Client</span>
            <span aria-hidden="true">·</span>
            <a href="https://github.com/hemanth/mcp-web-client" target="_blank" rel="noopener noreferrer">GitHub</a>
            <span aria-hidden="true">·</span>
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">MCP Spec</a>
            <span aria-hidden="true">·</span>
            <span>MIT License</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
