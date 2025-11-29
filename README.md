# MCP Web Client

A web-based client for the Model Context Protocol (MCP). Connect to multiple MCP servers, browse tools/resources/prompts, and interact via chat.

## Features

- **Multi-Server Support** - Connect to multiple MCP servers simultaneously
- **OAuth 2.0 & Bearer Token Auth** - Secure authentication with PKCE support
- **Persistent Sessions** - Servers and credentials saved to localStorage
- **Real-time SSE** - Server-Sent Events for live updates
- **Tools, Resources & Prompts** - Full MCP capability support

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Adding a Server

1. Click **+** in the sidebar
2. Enter the server URL (e.g., `https://mcp.example.com/sse`)
3. Choose authentication method:
   - **No Auth** - Public servers
   - **Bearer Token** - Use existing access token
   - **OAuth 2.0** - Authenticate via OAuth flow
4. Click **Add Server**

## Tech Stack

- Next.js 15 + React 19
- TypeScript
- Tailwind CSS
- MCP Protocol 2024-11-05

## License

MIT
