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
  sampling?: boolean;
  elicitation?: boolean;
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
  customHeaders?: Record<string, string>;
}

// Sampling Types (Server requests LLM completion from client)

export type Role = 'user' | 'assistant';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64
  mimeType: string;
}

export interface AudioContent {
  type: 'audio';
  data: string; // base64
  mimeType: string;
}

export type SamplingMessageContent = TextContent | ImageContent | AudioContent;

export interface SamplingMessage {
  role: Role;
  content: SamplingMessageContent | SamplingMessageContent[];
}

export interface ModelHint {
  name?: string;
}

export interface ModelPreferences {
  hints?: ModelHint[];
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}

export interface CreateMessageRequestParams {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateMessageResult {
  role: Role;
  content: SamplingMessageContent;
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens' | string;
}

export interface SamplingRequest {
  id: string | number;
  serverId: string;
  serverName: string;
  params: CreateMessageRequestParams;
  timestamp: number;
}

// Elicitation Types (Server requests user input from client)

export interface StringSchema {
  type: 'string';
  title?: string;
  description?: string;
  minLength?: number;
  maxLength?: number;
  format?: 'email' | 'uri' | 'date' | 'date-time';
  default?: string;
}

export interface NumberSchema {
  type: 'number' | 'integer';
  title?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  default?: number;
}

export interface BooleanSchema {
  type: 'boolean';
  title?: string;
  description?: string;
  default?: boolean;
}

export interface SingleSelectEnumSchema {
  type: 'string';
  title?: string;
  description?: string;
  enum?: string[];
  oneOf?: Array<{ const: string; title: string }>;
  default?: string;
}

export interface MultiSelectEnumSchema {
  type: 'array';
  title?: string;
  description?: string;
  minItems?: number;
  maxItems?: number;
  items: {
    enum?: string[];
    anyOf?: Array<{ const: string; title: string }>;
  };
  default?: string[];
}

export type PrimitiveSchemaDefinition =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | SingleSelectEnumSchema
  | MultiSelectEnumSchema;

export interface ElicitRequestFormParams {
  mode?: 'form';
  message: string;
  requestedSchema: {
    type: 'object';
    properties: Record<string, PrimitiveSchemaDefinition>;
    required?: string[];
  };
}

export interface ElicitRequestURLParams {
  mode: 'url';
  message: string;
  elicitationId: string;
  url: string;
}

export type ElicitRequestParams = ElicitRequestFormParams | ElicitRequestURLParams;

export interface ElicitResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: Record<string, string | number | boolean | string[]>;
}

export interface ElicitationRequest {
  id: string | number;
  serverId: string;
  serverName: string;
  params: ElicitRequestParams;
  timestamp: number;
}
