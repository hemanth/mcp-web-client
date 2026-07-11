import Link from 'next/link';
import {
  Zap,
  Server,
  Shield,
  Radio,
  Wrench,
  MessageSquare,
  Puzzle,
  ArrowRight,
  Github,
  Plus,
  KeyRound,
  Rocket,
  ExternalLink,
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
  { name: 'Notion', category: 'Productivity' },
  { name: 'Linear', category: 'Productivity' },
  { name: 'Stripe', category: 'Finance' },
  { name: 'Vercel', category: 'Developer' },
  { name: 'Cloudflare', category: 'Developer' },
  { name: 'Sentry', category: 'Developer' },
  { name: 'Figma', category: 'Design' },
  { name: 'HubSpot', category: 'Marketing' },
  { name: 'PayPal', category: 'Finance' },
  { name: 'PubMed', category: 'Research' },
  { name: 'Atlassian', category: 'Developer' },
  { name: 'Canva', category: 'Design' },
  { name: 'Asana', category: 'Productivity' },
  { name: 'Square', category: 'Finance' },
  { name: 'Box', category: 'Productivity' },
  { name: 'Intercom', category: 'Marketing' },
];

const categoryColors: Record<string, string> = {
  Productivity: 'bg-emerald-500/8 text-emerald-400/90 border-emerald-500/12',
  Developer: 'bg-violet-500/8 text-violet-400/90 border-violet-500/12',
  Finance: 'bg-amber-500/8 text-amber-400/90 border-amber-500/12',
  Design: 'bg-sky-500/8 text-sky-400/90 border-sky-500/12',
  Marketing: 'bg-rose-500/8 text-rose-400/90 border-rose-500/12',
  Research: 'bg-teal-500/8 text-teal-400/90 border-teal-500/12',
};

const steps = [
  {
    icon: Plus,
    number: '01',
    title: 'Add a server',
    description: 'Enter a URL or choose from 50+ pre-configured integrations.',
  },
  {
    icon: KeyRound,
    number: '02',
    title: 'Authenticate',
    description: 'OAuth 2.0, bearer tokens, or no auth. PKCE handled automatically.',
  },
  {
    icon: Rocket,
    number: '03',
    title: 'Start building',
    description: 'Browse tools, read resources, use prompts, and chat with LLMs.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] overflow-x-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-[var(--accent)] focus:text-white">Skip to content</a>

      {/* Navigation — minimal, barely there */}
      <nav className="fixed top-0 left-0 right-0 z-50 landing-nav">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-[var(--background)]" />
              </div>
              <span className="font-semibold text-sm tracking-tight">MCPHost</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/hemanth/mcp-web-client"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                aria-label="View on GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:bg-[var(--foreground)]/90 transition-colors"
              >
                Launch App
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content">
        {/* Hero — typographic, restrained */}
        <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 px-5 sm:px-8">
          <div className="hero-glow hero-glow-1" style={{ width: 700, height: 500 }} aria-hidden="true" />
          <div className="hero-glow hero-glow-2" style={{ width: 400, height: 300 }} aria-hidden="true" />
          <div className="hero-grid" aria-hidden="true" />

          <div className="relative max-w-3xl mx-auto">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-8 sm:mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] pulse-glow" />
              <span className="text-xs text-[var(--foreground-muted)] tracking-wide uppercase">Open Source · MIT</span>
            </div>

            {/* Heading — large, clean, great hierarchy */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-5">
              The universal client{' '}
              <br className="hidden sm:block" />
              for{' '}
              <span className="hero-gradient-text">Model Context Protocol.</span>
            </h1>

            {/* Subtitle — measured, no overselling */}
            <p className="max-w-xl text-base sm:text-lg text-[var(--foreground-muted)] mb-8 leading-relaxed">
              Connect to any MCP server from your browser. Browse tools, read resources, 
              use prompts, and chat with LLMs — all in one place.
            </p>

            {/* CTAs — clean, high contrast */}
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium text-sm transition-all hover:opacity-90"
              >
                Launch App
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com/hemanth/mcp-web-client"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--border-hover)] text-[var(--foreground-muted)] font-medium text-sm transition-all hover:text-[var(--foreground)] hover:border-[var(--border-active)]"
              >
                <Github className="w-4 h-4" />
                View Source
                <ExternalLink className="w-3 h-3 opacity-40" />
              </a>
            </div>

            {/* Tech pills — subtle */}
            <div className="flex flex-wrap items-center gap-2 mt-10 text-xs text-[var(--foreground-subtle)]">
              {['Next.js', 'TypeScript', 'MCP 2025-06-18', 'OAuth 2.0'].map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--background-secondary)]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features — grid, concise */}
        <section className="py-16 sm:py-24 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 sm:mb-14">
              <p className="text-xs text-[var(--accent)] font-medium tracking-widest uppercase mb-3">Capabilities</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Everything you need for MCP.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="landing-card group reveal-on-scroll"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/8 flex items-center justify-center mb-4">
                      <Icon className="w-4.5 h-4.5 text-[var(--accent)]" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1.5">{feature.title}</h3>
                    <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Integrations — clean pill cloud */}
        <section className="py-16 sm:py-24 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 sm:mb-14">
              <p className="text-xs text-[var(--accent)] font-medium tracking-widest uppercase mb-3">Ecosystem</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                50+ integrations, ready to connect.
              </h2>
            </div>

            <div className="flex flex-wrap gap-2 mb-8 reveal-on-scroll">
              {integrations.map((integration) => (
                <span
                  key={integration.name}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${categoryColors[integration.category] || 'bg-[var(--background-tertiary)] text-[var(--foreground-muted)] border-[var(--border)]'}`}
                >
                  {integration.name}
                </span>
              ))}
            </div>

            <div className="reveal-on-scroll">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors"
              >
                Browse all integrations
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* How it works — numbered, horizontal */}
        <section className="py-16 sm:py-24 px-5 sm:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-12 sm:mb-14">
              <p className="text-xs text-[var(--accent)] font-medium tracking-widest uppercase mb-3">Getting Started</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Three steps. Under a minute.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.number} className="reveal-on-scroll">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-mono text-[var(--accent)] font-semibold">{step.number}</span>
                      <div className="h-px flex-1 bg-[var(--border)]" />
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-[var(--background-tertiary)] border border-[var(--border)] flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-[var(--foreground-muted)]" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1.5">{step.title}</h3>
                    <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA — understated but clear */}
        <section className="py-16 sm:py-24 px-5 sm:px-8">
          <div className="max-w-2xl mx-auto reveal-on-scroll">
            <div className="p-8 sm:p-12 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)]">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                Ready to connect?
              </h2>
              <p className="text-[var(--foreground-muted)] text-sm sm:text-base mb-6 leading-relaxed">
                Launch the app and start connecting to MCP servers in seconds. No account required.
              </p>
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--background)] font-semibold text-sm transition-all hover:bg-[var(--accent-hover)]"
              >
                Launch MCPHost
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer — one line, minimal */}
        <footer className="py-6 px-5 sm:px-8 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--foreground-subtle)]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[var(--accent)] flex items-center justify-center">
                <Zap className="w-2.5 h-2.5 text-[var(--background)]" />
              </div>
              <span className="text-[var(--foreground-muted)] font-medium">MCPHost</span>
              <span>·</span>
              <span>Open Source MCP Client</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/hemanth/mcp-web-client"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--foreground-muted)] transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--foreground-muted)] transition-colors"
              >
                MCP Spec
              </a>
              <span>MIT License</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
