'use client';

import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Send, Bot, User, Loader2, Wrench, Settings, AlertCircle, RefreshCw, Trash2, Check, X, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MCPTool, ToolCallResult } from '@/lib/types';
import type { ChatMessage, ToolCall, LLMSettings, MCPToolDefinition, ToolResultContent } from '@/lib/llm-types';
import { LLM_PROVIDERS, DEFAULT_LLM_SETTINGS } from '@/lib/llm-types';
import { LLMSettingsModal, useLLMSettings } from './LLMSettings';
import { useLLMChat } from '@/lib/useLLMChat';

// Extended tool type that includes server info
interface MCPToolWithServer extends MCPTool {
  serverId?: string;
  serverName?: string;
}

interface ConnectedServer {
  id: string;
  name: string;
}

interface ChatPanelProps {
  tools: MCPToolWithServer[];
  onCallTool: (name: string, args: Record<string, unknown>, serverId?: string) => Promise<ToolCallResult>;
  disabled?: boolean;
  connectedServers?: ConnectedServer[];
}

// Convert MCP tools to LLM tool format, preserving server info
function convertToLLMTools(tools: MCPToolWithServer[]): MCPToolDefinition[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    serverId: tool.serverId,
    serverName: tool.serverName,
  }));
}

export const ChatPanel = memo(function ChatPanel({ tools, onCallTool, disabled, connectedServers = [] }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { settings, updateSettings, isLoaded } = useLLMSettings();

  // Handle tool execution from LLM - routes to correct server based on serverId
  const handleToolCall = useCallback(async (toolCall: ToolCall): Promise<ToolCallResult> => {
    const result = await onCallTool(toolCall.name, toolCall.arguments, toolCall.serverId);
    return result;
  }, [onCallTool]);

  const llmTools = convertToLLMTools(tools);

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage,
  } = useLLMChat({
    settings,
    tools: llmTools,
    onToolCall: handleToolCall,
  });

  // Compute activity status for the thinking indicator
  const getActivityStatus = useCallback(() => {
    if (!isLoading) return null;

    // Check if there are any running tool calls in the last assistant message
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg?.toolCalls) {
      const runningTool = lastAssistantMsg.toolCalls.find(tc => tc.status === 'running');
      if (runningTool) {
        return { type: 'tool', toolName: runningTool.name };
      }
      // Check if all tools completed and we're waiting for LLM response
      const allCompleted = lastAssistantMsg.toolCalls.every(tc => tc.status === 'completed' || tc.status === 'error');
      if (allCompleted && lastAssistantMsg.toolCalls.length > 0) {
        return { type: 'thinking-after-tools' };
      }
    }

    return { type: 'thinking' };
  }, [isLoading, messages]);

  const activityStatus = getActivityStatus();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || disabled) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const activeProvider = settings.activeProvider
    ? LLM_PROVIDERS.find(p => p.id === settings.activeProvider)
    : null;

  const activeConfig = settings.activeProvider
    ? settings.providers[settings.activeProvider]
    : null;

  return (
    <div className="flex flex-col h-full bg-[var(--background-secondary)] rounded-xl border border-[var(--border)]">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 flex-wrap">
          {activeProvider ? (
            <>
              <div className="w-2 h-2 rounded-full bg-[var(--success)] pulse-glow" />
              <span className="font-medium text-sm">
                {activeProvider.name}
              </span>
              <span className="text-xs text-[var(--foreground-muted)]">
                ({activeConfig?.model})
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="font-medium text-sm text-[var(--foreground-muted)]">
                No LLM Connected
              </span>
            </>
          )}
          {/* Connected servers */}
          {connectedServers.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[var(--border)]">
              {connectedServers.map(server => (
                <span
                  key={server.id}
                  className="px-2 py-0.5 text-xs bg-[var(--background-tertiary)] rounded-full text-[var(--foreground-muted)] flex items-center gap-1"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                  {server.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--foreground-muted)]">
            {tools.length} tools
          </span>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-1.5 hover:bg-[var(--background-tertiary)] rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4 text-[var(--foreground-muted)]" />
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-[var(--background-tertiary)] rounded-lg transition-colors"
            title="LLM Settings"
          >
            <Settings className="w-4 h-4 text-[var(--foreground-muted)]" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeProvider && isLoaded && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4">
              <Settings className="w-8 h-8 text-yellow-500" />
            </div>
            <h3 className="text-lg font-medium mb-2">Configure an LLM Provider</h3>
            <p className="text-sm text-[var(--foreground-muted)] max-w-sm mb-4">
              Connect to OpenAI, Anthropic, Google Gemini, or Ollama to start chatting with AI.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Open Settings
            </button>
          </div>
        )}

        {activeProvider && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-12 h-12 text-[var(--foreground-muted)] mb-4" />
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-sm text-[var(--foreground-muted)] max-w-sm">
              Ask me anything! I can use {tools.length} tools from connected MCP servers.
            </p>
            {tools.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
                {tools.slice(0, 5).map(tool => (
                  <span
                    key={`${tool.serverId || 'default'}-${tool.name}`}
                    className="px-3 py-1.5 text-xs bg-[var(--background-tertiary)] rounded-full text-[var(--foreground-muted)]"
                    title={tool.serverName ? `From ${tool.serverName}` : undefined}
                  >
                    {tool.name}
                  </span>
                ))}
                {tools.length > 5 && (
                  <span className="px-3 py-1.5 text-xs bg-[var(--background-tertiary)] rounded-full text-[var(--foreground-muted)]">
                    +{tools.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {activityStatus && (
          <div className="flex items-center gap-2 px-2 py-1">
            <Loader2 className="w-3 h-3 animate-spin text-[var(--foreground-muted)]" />
            <span className="text-xs italic text-[var(--foreground-muted)]">
              {activityStatus.type === 'tool' && `Running ${activityStatus.toolName}...`}
              {activityStatus.type === 'thinking-after-tools' && 'Analyzing results...'}
              {activityStatus.type === 'thinking' && 'Thinking...'}
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={retryLastMessage}
              className="p-1 hover:bg-red-500/20 rounded transition-colors"
              title="Retry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-[var(--border)]">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? 'Connect to a server first...'
                : !activeProvider
                ? 'Configure an LLM provider to start chatting...'
                : 'Type a message...'
            }
            disabled={disabled || isLoading || !activeProvider}
            rows={1}
            className="w-full px-4 py-3 pr-12 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm placeholder:text-[var(--foreground-muted)]"
          />
          <button
            type="submit"
            disabled={disabled || isLoading || !input.trim() || !activeProvider}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--accent)]"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </form>
      </div>

      {/* Settings Modal */}
      <LLMSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSettingsChange={updateSettings}
        currentSettings={settings}
      />
    </div>
  );
});

// Message bubble component
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isAssistant = message.role === 'assistant';

  if (isTool) {
    // Check if this tool result has UI resources (HTML) that should be shown expanded
    const hasUiResource = message.toolResultContent?.some(
      item => item.type === 'resource' && item.resource?.mimeType?.includes('html')
    );

    // Tool results are rendered inline with tool calls now via ToolCallBubble
    // Only render standalone tool results for UI resources that need full width display
    if (hasUiResource) {
      return (
        <div className="w-full">
          <div className="space-y-2">
            {message.toolResultContent?.map((item, index) => (
              <ToolResultContentRenderer key={index} item={item} />
            ))}
          </div>
        </div>
      );
    }

    // For non-UI tool results, don't render separately - they're shown in the tool call toggle
    return null;
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--background-tertiary)] flex items-center justify-center">
          <Bot className="w-4 h-4 text-[var(--foreground-muted)]" />
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[80%] min-w-0 ${isUser ? 'order-first' : ''}`}>
        {/* Tool calls */}
        {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-2">
            {message.toolCalls.map(toolCall => (
              <ToolCallBubble key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <>
            <div className={`rounded-2xl px-4 py-2.5 ${
              isUser
                ? 'bg-[var(--accent)] text-white rounded-br-md'
                : message.error
                ? 'bg-red-500/10 border border-red-500/20 text-red-400 rounded-bl-md'
                : 'bg-[var(--background-tertiary)] border border-[var(--border)] rounded-bl-md'
            }`}>
              {isUser ? (
                <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
              ) : (
                <div className="text-sm prose prose-sm prose-invert max-w-none break-words
                  prose-p:my-1 prose-p:leading-relaxed
                  prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-semibold
                  prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                  prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                  prose-code:bg-[var(--background)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-[var(--background)] prose-pre:p-3 prose-pre:rounded-lg prose-pre:my-2
                  prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline
                  prose-blockquote:border-l-2 prose-blockquote:border-[var(--border)] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-2
                  prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-th:border prose-td:border prose-th:border-[var(--border)] prose-td:border-[var(--border)]
                  prose-strong:font-semibold prose-em:italic
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            <div className="text-xs text-[var(--foreground-muted)] mt-1 px-1">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </>
        )}

        {/* Error state */}
        {message.error && !message.content && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl rounded-bl-md px-4 py-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{message.error}</span>
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

// Tool call indicator - subtle like Claude's interface
function ToolCallBubble({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusText = {
    pending: 'Preparing to use',
    running: 'Using',
    completed: 'Used',
    error: 'Failed to use',
  };

  // Extract result content for display
  const resultContent = toolCall.result as { content?: ToolResultContent[]; isError?: boolean } | undefined;
  const hasResult = toolCall.status === 'completed' && resultContent?.content;

  // Format result text for display
  const getResultText = () => {
    if (!resultContent?.content) return null;
    return resultContent.content
      .map(item => {
        if (item.type === 'text') return item.text;
        if (item.type === 'resource' && item.resource?.text) {
          // Skip HTML resources - they're rendered separately
          if (item.resource.mimeType?.includes('html')) return null;
          return item.resource.text;
        }
        return JSON.stringify(item);
      })
      .filter(Boolean)
      .join('\n');
  };

  const resultText = getResultText();

  return (
    <div className="py-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors group"
      >
        {toolCall.status === 'running' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : toolCall.status === 'completed' ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : toolCall.status === 'error' ? (
          <X className="w-3 h-3 text-red-400" />
        ) : (
          <Wrench className="w-3 h-3" />
        )}
        <span className="italic">
          {statusText[toolCall.status]} <span className="font-medium not-italic">{toolCall.name}</span>
        </span>
        <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>
      {isExpanded && (
        <div className="mt-1 ml-4 pl-2 border-l border-[var(--border)] text-xs text-[var(--foreground-muted)]">
          {/* Arguments section */}
          {Object.keys(toolCall.arguments).length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wide opacity-50 mb-1">Input</div>
              <pre className="font-mono text-[10px] whitespace-pre-wrap break-all opacity-75 bg-[var(--background)] p-2 rounded">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}
          {/* Result section */}
          {hasResult && resultText && (
            <div>
              <div className="text-[10px] uppercase tracking-wide opacity-50 mb-1">Output</div>
              <pre className="font-mono text-[10px] whitespace-pre-wrap break-all opacity-75 bg-[var(--background)] p-2 rounded max-h-32 overflow-y-auto">
                {resultText}
              </pre>
            </div>
          )}
          {/* Error section */}
          {toolCall.error && (
            <div className="text-red-400 mt-1">
              Error: {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Render tool result content (text, resources, images)
function ToolResultContentRenderer({ item }: { item: ToolResultContent }) {
  const [iframeHeight, setIframeHeight] = useState(400);

  // Check if this is a UI resource (HTML)
  const isHtmlResource = item.type === 'resource' &&
    item.resource?.mimeType?.includes('html') &&
    item.resource?.text;

  // Check if this is an image
  const isImage = item.type === 'image' ||
    (item.type === 'resource' && item.resource?.mimeType?.startsWith('image/'));

  // Handle iframe load for auto-resize
  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const iframe = e.currentTarget;
      if (iframe?.contentWindow?.document?.body) {
        const height = iframe.contentWindow.document.body.scrollHeight;
        setIframeHeight(Math.min(Math.max(height + 20, 200), 600));
      }
    } catch {
      // Cross-origin restriction, use default height
    }
  };

  // Render HTML resource in iframe
  if (isHtmlResource && item.resource) {
    return (
      <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-white">
        <iframe
          srcDoc={item.resource.text}
          title="UI Resource"
          className="w-full"
          sandbox="allow-same-origin allow-scripts"
          style={{ border: 'none', height: `${iframeHeight}px` }}
          onLoad={handleIframeLoad}
        />
      </div>
    );
  }

  // Render image
  if (isImage) {
    const imageData = item.data || item.resource?.blob;
    const mimeType = item.mimeType || item.resource?.mimeType || 'image/png';
    if (imageData) {
      return (
        <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background-tertiary)] p-2">
          <img
            src={`data:${mimeType};base64,${imageData}`}
            alt="Tool result"
            className="max-w-full h-auto rounded"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
          />
        </div>
      );
    }
  }

  // Render text content
  if (item.type === 'text' && item.text) {
    // Try to parse as JSON for pretty formatting
    let displayText = item.text;
    try {
      const parsed = JSON.parse(item.text);
      displayText = JSON.stringify(parsed, null, 2);
    } catch {
      // Keep as-is if not JSON
    }

    return (
      <div className="bg-[var(--background-tertiary)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-2.5">
        <pre className="text-sm whitespace-pre-wrap font-mono text-xs break-words overflow-x-auto max-h-48 overflow-y-auto">
          {displayText}
        </pre>
      </div>
    );
  }

  // Render resource text (non-HTML)
  if (item.type === 'resource' && item.resource?.text && !isHtmlResource) {
    return (
      <div className="bg-[var(--background-tertiary)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-2.5">
        <pre className="text-sm whitespace-pre-wrap font-mono text-xs break-words overflow-x-auto max-h-48 overflow-y-auto">
          {item.resource.text}
        </pre>
      </div>
    );
  }

  // Fallback: render as JSON
  return (
    <div className="bg-[var(--background-tertiary)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-2.5">
      <pre className="text-sm whitespace-pre-wrap font-mono text-xs break-words overflow-x-auto max-h-48 overflow-y-auto">
        {JSON.stringify(item, null, 2)}
      </pre>
    </div>
  );
}
