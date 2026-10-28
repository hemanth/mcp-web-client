// MCP Protocol Types

export interface MCPClientInfo {
  name: string;
  version: string;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  // SEP-973: Metadata
  title?: string;
  description?: string;
  icons?: Array<{ src: string; mimeType?: string; sizes?: string[]; theme?: 'light' | 'dark' }>;
  websiteUrl?: string;
}

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
  sampling?: boolean;
  elicitation?: boolean;
  extensions?: Record<string, unknown>;
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

export interface MCPToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  outputSchema?: Record<string, unknown>;
  annotations?: MCPToolAnnotations;
  // SEP-973: Metadata
  title?: string;
  icons?: Array<{ src: string; mimeType?: string; sizes?: string[]; theme?: 'light' | 'dark' }>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  // SEP-973: Metadata
  title?: string;
  icons?: Array<{ src: string; mimeType?: string; sizes?: string[]; theme?: 'light' | 'dark' }>;
}

export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
  // SEP-973: Metadata
  title?: string;
  icons?: Array<{ src: string; mimeType?: string; sizes?: string[]; theme?: 'light' | 'dark' }>;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  // SEP-973: Metadata
  title?: string;
  icons?: Array<{ src: string; mimeType?: string; sizes?: string[]; theme?: 'light' | 'dark' }>;
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

export interface ResourceLinkContent {
  type: 'resource_link';
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
    // resource_link fields
    uri?: string;
    name?: string;
    description?: string;
  } | ResourceLinkContent>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
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

// Progress Notification
export interface MCPProgressNotification {
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
}

// Log Message
export interface MCPLogMessage {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  logger?: string;
  data: unknown;
  timestamp: number;
}

// Completion Result
export interface MCPCompletionResult {
  values: string[];
  total?: number;
  hasMore?: boolean;
}

// Events Extension Types (io.modelcontextprotocol/events — SEP-3415)

export type EventDeliveryMode = 'poll' | 'push' | 'webhook';

export interface MCPEventType {
  name: string;
  description?: string;
  delivery: EventDeliveryMode[];
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  payloadSchema?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface MCPEventOccurrence {
  eventId: string;
  name: string;
  timestamp: string;
  data: Record<string, unknown>;
  cursor?: string | null;
  _meta?: Record<string, unknown>;
}

export interface MCPEventPollResult {
  resultType: 'complete';
  events: MCPEventOccurrence[];
  cursor: string | null;
  truncated: boolean;
  hasMore: boolean;
  nextPollMs: number;
}

export interface EventSubscription {
  serverId: string;
  eventName: string;
  arguments: Record<string, unknown>;
  cursor: string | null;
  nextPollMs: number;
  active: boolean;
  receivedEvents: MCPEventOccurrence[];
}

// Tasks Extension Types (io.modelcontextprotocol/tasks — SEP-2663)

export type TaskStatus = 'working' | 'input_required' | 'completed' | 'cancelled' | 'failed';

export interface MCPTask {
  taskId: string;
  status: TaskStatus;
  statusMessage?: string;
  createdAt: string;
  lastUpdatedAt?: string;
  ttlMs?: number | null;
  pollIntervalMs?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  _meta?: Record<string, unknown>;
}

// Skills Extension Types (io.modelcontextprotocol/skills — SEP-2640)

export interface MCPSkillFile {
  uri: string;
  size?: number;
  sha256?: string;
}

export interface MCPSkill {
  uri: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  files?: MCPSkillFile[];
  dynamic?: boolean;
  _meta?: Record<string, unknown>;
}

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
  resourceTemplates: MCPResourceTemplate[];
  prompts: MCPPrompt[];
  eventTypes: MCPEventType[];
  // SEP-2663: Tasks
  tasks: MCPTask[];
  // SEP-2640: Skills
  skills: MCPSkill[];
  credentials?: OAuthCredentials;
  customHeaders?: Record<string, string>;
  logMessages: MCPLogMessage[];
  activeProgress: Map<string | number, MCPProgressNotification>;
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
  // SEP-1577: Sampling with tools
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema: {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
  }>;
  toolChoice?: {
    mode: 'auto' | 'required' | 'none';
  };
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
