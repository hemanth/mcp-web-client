// MCP Protocol Types

export interface MCPClientInfo {
  name: string;
  version: string;
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  clientInfo: MCPClientInfo;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: MCPServerInfo;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export type MCPMessage = MCPRequest | MCPResponse | MCPNotification;

// OAuth Types

export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number;
  scope?: string;
}

export interface OAuthClientRegistration {
  clientId: string;
  clientSecret?: string;
  registrationAccessToken?: string;
  clientIdIssuedAt?: number;
  clientSecretExpiresAt?: number;
}

export interface ServerConnection {
  serverUrl: string;
  authType: 'none' | 'bearer' | 'oauth';
  credentials?: OAuthCredentials;
  clientRegistration?: OAuthClientRegistration;
  serverInfo?: MCPServerInfo;
  capabilities?: MCPCapabilities;
  connected: boolean;
}

// Connection State

export type ConnectionStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  error?: string;
  serverUrl?: string;
  serverInfo?: MCPServerInfo;
  capabilities?: MCPCapabilities;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

// Tool Execution

export interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// Resource Content Types
export interface ResourceContentItem {
  type: 'text' | 'blob';
  uri: string;
  text?: string;
  blob?: string; // base64 encoded
  mimeType?: string;
}

export interface ResourceReadResult {
  contents: ResourceContentItem[];
}

// Transport Types

export type TransportType = 'sse' | 'streamable-http';

// Multi-Server Types

export interface ServerInstance {
  id: string;
  url: string;
  name: string;
  status: ConnectionStatus;
  transport?: TransportType;
  error?: string;
  serverInfo?: MCPServerInfo;
  capabilities?: MCPCapabilities;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  credentials?: OAuthCredentials;
}
