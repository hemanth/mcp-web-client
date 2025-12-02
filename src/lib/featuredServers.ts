export interface FeaturedServer {
  name: string;
  description: string;
  url: string;
  category: 'productivity' | 'developer' | 'data' | 'finance' | 'marketing' | 'research';
  requiresAuth?: boolean;
  requiresUserUrl?: boolean;
}

export const featuredServers: FeaturedServer[] = [
  // Productivity
  {
    name: 'Notion',
    description: 'Search, update, and power workflows across your Notion workspace',
    url: 'https://mcp.notion.com/mcp',
    category: 'productivity',
    requiresAuth: true,
  },
  {
    name: 'Linear',
    description: 'Manage issues, projects & team workflows',
    url: 'https://mcp.linear.app/sse',
    category: 'productivity',
    requiresAuth: true,
  },
  {
    name: 'Asana',
    description: 'Coordinate tasks, projects, and goals',
    url: 'https://mcp.asana.com/sse',
    category: 'productivity',
    requiresAuth: true,
  },
  {
    name: 'Monday',
    description: 'Manage projects, boards, and workflows',
    url: 'https://mcp.monday.com/mcp',
    category: 'productivity',
    requiresAuth: true,
  },
  {
    name: 'Clockwise',
    description: 'Advanced scheduling and time management',
    url: 'https://mcp.getclockwise.com/mcp',
    category: 'productivity',
    requiresAuth: true,
  },
  {
    name: 'Jotform',
    description: 'Create forms & analyze submissions',
    url: 'https://mcp.jotform.com/',
    category: 'productivity',
    requiresAuth: true,
  },

  // Developer Tools
  {
    name: 'Netlify',
    description: 'Create, deploy, manage, and secure websites',
    url: 'https://netlify-mcp.netlify.app/mcp',
    category: 'developer',
    requiresAuth: true,
  },
  {
    name: 'Vercel',
    description: 'Analyze, debug, and manage projects and deployments',
    url: 'https://mcp.vercel.com',
    category: 'developer',
    requiresAuth: true,
  },
  {
    name: 'Cloudflare',
    description: 'Build applications with compute, storage, and AI',
    url: 'https://bindings.mcp.cloudflare.com/mcp',
    category: 'developer',
    requiresAuth: true,
  },
  {
    name: 'Sentry',
    description: 'Search, query, and debug errors intelligently',
    url: 'https://mcp.sentry.dev/mcp',
    category: 'developer',
    requiresAuth: true,
  },
  {
    name: 'Honeycomb',
    description: 'Query and explore observability data and SLOs',
    url: 'https://mcp.honeycomb.io/mcp',
    category: 'developer',
    requiresAuth: true,
  },
  {
    name: 'Jam',
    description: 'Record screen and collect automatic context for issues',
    url: 'https://mcp.jam.dev/mcp',
    category: 'developer',
    requiresAuth: true,
  },
  {
    name: 'Hugging Face',
    description: 'Access the HF Hub and thousands of Gradio Apps',
    url: 'https://huggingface.co/mcp?login',
    category: 'developer',
    requiresAuth: true,
  },
  {
    name: 'Stytch',
    description: 'Manage your Stytch authentication project',
    url: 'https://mcp.stytch.dev/mcp',
    category: 'developer',
    requiresAuth: true,
  },

  // Data & Analytics
  {
    name: 'Atlassian',
    description: 'Access Jira & Confluence from Claude',
    url: 'https://mcp.atlassian.com/v1/sse',
    category: 'data',
    requiresAuth: true,
  },
  {
    name: 'Box',
    description: 'Search, access and get insights on your Box content',
    url: 'https://mcp.box.com',
    category: 'data',
    requiresAuth: true,
  },
  {
    name: 'Egnyte',
    description: 'Securely access and analyze Egnyte content',
    url: 'https://mcp-server.egnyte.com/mcp',
    category: 'data',
    requiresAuth: true,
  },
  {
    name: 'Figma',
    description: 'Create better code with Figma context',
    url: 'https://mcp.figma.com/mcp',
    category: 'data',
    requiresAuth: true,
  },
  {
    name: 'Canva',
    description: 'Search, create, autofill, and export Canva designs',
    url: 'https://mcp.canva.com/mcp',
    category: 'data',
    requiresAuth: true,
  },
  {
    name: 'Cloudinary',
    description: 'Manage, transform and deliver images & videos',
    url: 'https://asset-management.mcp.cloudinary.com/sse',
    category: 'data',
    requiresAuth: true,
  },
  {
    name: 'Coupler.io',
    description: 'Access business data from hundreds of sources',
    url: 'https://mcp.coupler.io/mcp',
    category: 'data',
    requiresAuth: true,
  },
  {
    name: 'CData Connect AI',
    description: 'Connect 270+ enterprise sources to Claude',
    url: 'https://mcp.cloud.cdata.com/mcp',
    category: 'data',
    requiresAuth: true,
  },

  // Finance & Payments
  {
    name: 'Stripe',
    description: 'Payment processing and financial infrastructure tools',
    url: 'https://mcp.stripe.com',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'PayPal',
    description: 'Access PayPal payments platform',
    url: 'https://mcp.paypal.com/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'Square',
    description: 'Search and manage transaction, merchant, and payment data',
    url: 'https://mcp.squareup.com/sse',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'Ramp',
    description: 'Search, access, and analyze your Ramp financial data',
    url: 'https://ramp-mcp-remote.ramp.com/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'Morningstar',
    description: 'Up-to-date investment and market insights',
    url: 'https://mcp.morningstar.com/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'Pitchbook',
    description: 'PitchBook data, embedded in the way you work',
    url: 'https://premium.mcp.pitchbook.com/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'Chronograph',
    description: 'Interact with your Chronograph data directly',
    url: 'https://ai.chronograph.pe/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: "Moody's Analytics",
    description: 'Risk insights, analytics, and decision intelligence',
    url: 'https://api.moodys.com/genai-ready-data/m1/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'S&P Global',
    description: 'Query S&P Global datasets like Financials',
    url: 'https://kfinance.kensho.com/integrations/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'LSEG',
    description: 'Access data & analytics across asset classes',
    url: 'https://api.analytics.lseg.com/lfa/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'Daloopa',
    description: 'Financial fundamental data and KPIs with hyperlinks',
    url: 'https://mcp.daloopa.com/server/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'MT Newswires',
    description: 'Trusted real-time global financial news',
    url: 'https://vast-mcp.blueskyapi.com/mcp',
    category: 'finance',
    requiresAuth: true,
  },
  {
    name: 'Aiera',
    description: 'Live events, filings, company publications',
    url: 'https://mcp-pub.aiera.com/',
    category: 'finance',
  },

  // Marketing & CRM
  {
    name: 'HubSpot',
    description: 'Chat with your CRM data to get personalized insights',
    url: 'https://mcp.hubspot.com/anthropic',
    category: 'marketing',
    requiresAuth: true,
  },
  {
    name: 'Close',
    description: 'Securely connect Claude to your Close data',
    url: 'https://mcp.close.com/mcp',
    category: 'marketing',
    requiresAuth: true,
  },
  {
    name: 'Intercom',
    description: 'AI access to Intercom data for customer insights',
    url: 'https://mcp.intercom.com/mcp',
    category: 'marketing',
    requiresAuth: true,
  },
  {
    name: 'Day AI',
    description: 'Analyze & update CRM records',
    url: 'https://day.ai/api/mcp',
    category: 'marketing',
    requiresAuth: true,
  },
  {
    name: 'Crossbeam',
    description: 'Explore partner data and ecosystem insights',
    url: 'https://mcp.crossbeam.com',
    category: 'marketing',
    requiresAuth: true,
  },
  {
    name: 'ZoomInfo',
    description: 'Enrich contacts & accounts with GTM intelligence',
    url: 'https://mcp.zoominfo.com/mcp',
    category: 'marketing',
    requiresAuth: true,
  },
  {
    name: 'Aura',
    description: 'Company intelligence & workforce analytics',
    url: 'https://mcp.auraintelligence.com/mcp',
    category: 'marketing',
    requiresAuth: true,
  },

  // Research & Knowledge
  {
    name: 'PubMed',
    description: 'Search biomedical literature from PubMed',
    url: 'https://pubmed.mcp.claude.com/mcp',
    category: 'research',
  },
  {
    name: 'Scholar Gateway',
    description: 'Enhance responses with scholarly research and citations',
    url: 'https://connector.scholargateway.ai/mcp',
    category: 'research',
  },
  {
    name: 'Synapse.org',
    description: 'Search and metadata tools for Synapse scientific data',
    url: 'https://mcp.synapse.org/mcp',
    category: 'research',
  },
  {
    name: 'BioRender',
    description: 'Search for and use scientific templates and icons',
    url: 'https://mcp.services.biorender.com/mcp',
    category: 'research',
    requiresAuth: true,
  },
  {
    name: 'Learning Commons',
    description: 'K-12 standards, skills, and learning progressions',
    url: 'https://kg.mcp.learningcommons.org/mcp',
    category: 'research',
  },
  {
    name: 'Fellow.ai',
    description: 'Chat with your meetings to uncover actionable insights',
    url: 'https://fellow.app/mcp',
    category: 'research',
    requiresAuth: true,
  },
  {
    name: 'Fireflies',
    description: 'Analyze and generate insights from meeting transcripts',
    url: 'https://api.fireflies.ai/mcp',
    category: 'research',
    requiresAuth: true,
  },

  // Travel & Other
  {
    name: 'Kiwi.com Flights',
    description: 'Search Kiwi.com flights in AI chats',
    url: 'https://mcp.kiwi.com',
    category: 'productivity',
  },
  {
    name: 'Indeed',
    description: 'Search for jobs on Indeed',
    url: 'https://mcp.indeed.com/claude/mcp',
    category: 'productivity',
  },
  {
    name: 'Ticket Tailor',
    description: 'Event platform for managing tickets, orders & more',
    url: 'https://mcp.tickettailor.ai/mcp',
    category: 'productivity',
    requiresAuth: true,
  },
  {
    name: 'Melon',
    description: 'Browse music charts & personalized music picks',
    url: 'https://mcp.melon.com/mcp/',
    category: 'productivity',
  },
];

export const categoryLabels: Record<FeaturedServer['category'], string> = {
  productivity: 'Productivity',
  developer: 'Developer Tools',
  data: 'Data & Analytics',
  finance: 'Finance & Payments',
  marketing: 'Marketing & CRM',
  research: 'Research & Knowledge',
};

export const categoryIcons: Record<FeaturedServer['category'], string> = {
  productivity: '📋',
  developer: '🛠️',
  data: '📊',
  finance: '💰',
  marketing: '📈',
  research: '🔬',
};
