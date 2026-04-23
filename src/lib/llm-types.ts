// LLM Provider Types

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'nvidia' | 'custom';

export interface LLMProviderConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string; // For Ollama, NVIDIA, or custom endpoints
  model: string;
  enabled: boolean;
  customHeaders?: Record<string, string>; // For custom endpoint headers
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
    description: 'GPT-5.4 and reasoning models',
    requiresApiKey: true,
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4', contextWindow: 1047576, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', contextWindow: 1047576, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', contextWindow: 1047576, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1047576, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextWindow: 1047576, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
      { id: 'o3-mini', name: 'o3-mini', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'o4-mini', name: 'o4-mini', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Opus 4 and Sonnet 4 models',
    requiresApiKey: true,
    models: [
      { id: 'claude-opus-4-20250715', name: 'Claude Opus 4', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, supportsTools: true, supportsStreaming: true },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 3.1, 2.5, and 2.0 models',
    requiresApiKey: true,
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', contextWindow: 1048576, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', contextWindow: 1048576, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', contextWindow: 1048576, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1048576, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, supportsTools: true, supportsStreaming: true },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local models via Ollama',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:11434',
    models: [
      { id: 'llama3.3', name: 'Llama 3.3', supportsTools: true, supportsStreaming: true },
      { id: 'llama3.2', name: 'Llama 3.2', supportsTools: true, supportsStreaming: true },
      { id: 'llama4', name: 'Llama 4', supportsTools: true, supportsStreaming: true },
      { id: 'qwen3', name: 'Qwen 3', supportsTools: true, supportsStreaming: true },
      { id: 'gemma3', name: 'Gemma 3', supportsTools: true, supportsStreaming: true },
      { id: 'mistral', name: 'Mistral', supportsTools: true, supportsStreaming: true },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', supportsTools: true, supportsStreaming: true },
      { id: 'phi4', name: 'Phi-4', supportsTools: false, supportsStreaming: true },
      { id: 'deepseek-r1', name: 'DeepSeek R1', supportsTools: false, supportsStreaming: true },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'NVIDIA hosted models via build.nvidia.com',
    requiresApiKey: true,
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    models: [
      // Meta Llama
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'meta/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      // NVIDIA Nemotron
      { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', name: 'Nemotron Super 49B v1.5', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B Instruct', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'nvidia/nvidia-nemotron-nano-9b-v2', name: 'Nemotron Nano 9B v2', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      // Mistral
      { id: 'mistralai/mistral-large-3-675b-instruct-2512', name: 'Mistral Large 3 675B', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'mistralai/mistral-medium-3-instruct', name: 'Mistral Medium 3', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      // DeepSeek
      { id: 'deepseek-ai/deepseek-v3.2', name: 'DeepSeek V3.2', contextWindow: 65536, supportsTools: false, supportsStreaming: true },
      { id: 'deepseek-ai/deepseek-v3.1-terminus', name: 'DeepSeek V3.1 Terminus', contextWindow: 65536, supportsTools: false, supportsStreaming: true },
      // Qwen
      { id: 'qwen/qwen3.5-397b-a17b', name: 'Qwen 3.5 397B', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'qwen/qwen3.5-122b-a10b', name: 'Qwen 3.5 122B', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'qwen/qwen3-coder-480b-a35b-instruct', name: 'Qwen 3 Coder 480B', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      // Google
      { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B', contextWindow: 131072, supportsTools: false, supportsStreaming: true },
      { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', contextWindow: 131072, supportsTools: false, supportsStreaming: true },
      // Moonshot
      { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      // Others
      { id: 'microsoft/phi-4-mini-instruct', name: 'Phi-4 Mini', contextWindow: 16384, supportsTools: false, supportsStreaming: true },
      { id: 'minimaxai/minimax-m2.7', name: 'MiniMax M2.7', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
      { id: 'z-ai/glm-5.1', name: 'GLM 5.1', contextWindow: 131072, supportsTools: true, supportsStreaming: true },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    description: 'Any OpenAI-compatible API endpoint',
    requiresApiKey: false,
    models: [
      { id: 'custom', name: 'Custom Model', supportsTools: true, supportsStreaming: true },
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
  customHeaders?: Record<string, string>;
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

// Helper to get all provider keys for iteration
export const ALL_PROVIDER_KEYS: LLMProvider[] = ['openai', 'anthropic', 'gemini', 'ollama', 'nvidia', 'custom'];

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  activeProvider: null,
  providers: {
    openai: { provider: 'openai', model: 'gpt-4o-mini', enabled: false },
    anthropic: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', enabled: false },
    gemini: { provider: 'gemini', model: 'gemini-2.0-flash-exp', enabled: false },
    ollama: { provider: 'ollama', model: 'llama3.2', baseUrl: 'http://localhost:11434', enabled: false },
    nvidia: { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct', baseUrl: 'https://integrate.api.nvidia.com/v1', enabled: false },
    custom: { provider: 'custom', model: '', baseUrl: '', enabled: false, customHeaders: {} },
  },
};
