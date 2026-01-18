// LLM Provider Types

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface LLMProviderConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string; // For Ollama or custom endpoints
  model: string;
  enabled: boolean;
}

export interface LLMProviderInfo {
  id: LLMProvider;
  name: string;
  description: string;
  requiresApiKey: boolean;
  defaultBaseUrl?: string;
  models: LLMModelInfo[];
}

export interface LLMModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
}

// Provider definitions with available models
export const LLM_PROVIDERS: LLMProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4, and GPT-3.5 models',
    requiresApiKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385, supportsTools: true, supportsStreaming: true },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 and Claude 3 models',
    requiresApiKey: true,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro and Flash models',
    requiresApiKey: true,
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', contextWindow: 1000000, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-exp-1206', name: 'Gemini Exp 1206', contextWindow: 2000000, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-2.0-flash-thinking-exp-1219', name: 'Gemini 2.0 Flash Thinking (Exp)', contextWindow: 32000, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B', contextWindow: 1000000, supportsTools: true, supportsStreaming: true },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local models via Ollama',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:11434',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', supportsTools: true, supportsStreaming: true },
      { id: 'llama3.1', name: 'Llama 3.1', supportsTools: true, supportsStreaming: true },
      { id: 'mistral', name: 'Mistral', supportsTools: true, supportsStreaming: true },
      { id: 'codellama', name: 'Code Llama', supportsTools: false, supportsStreaming: true },
      { id: 'phi3', name: 'Phi-3', supportsTools: false, supportsStreaming: true },
    ],
  },
];

// Tool Result Content (from MCP)
export interface ToolResultContent {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

// Chat Message Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolResultContent?: ToolResultContent[]; // Raw MCP tool result for rich rendering
  isStreaming?: boolean;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  serverId?: string;
  result?: unknown;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

// API Request/Response Types
export interface LLMChatRequest {
  provider: LLMProvider;
  model: string;
  messages: ChatMessage[];
  tools?: MCPToolDefinition[];
  stream?: boolean;
  apiKey?: string;
  baseUrl?: string;
}

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  serverId?: string;
  serverName?: string;
  examples?: Array<{
    input: Record<string, unknown>;
    output: string;
  }>;
  deferLoading?: boolean;
}

export interface LLMChatResponse {
  message: ChatMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Streaming Types
export interface LLMStreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCall>;
  error?: string;
}

// Settings Storage
export interface LLMSettings {
  activeProvider: LLMProvider | null;
  providers: Record<LLMProvider, LLMProviderConfig>;
  systemPrompt?: string;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  activeProvider: null,
  providers: {
    openai: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
    anthropic: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', enabled: false },
    gemini: { provider: 'gemini', model: 'gemini-2.0-flash-exp', enabled: false },
    ollama: { provider: 'ollama', model: 'llama3.2', baseUrl: 'http://localhost:11434', enabled: false },
  },
};
