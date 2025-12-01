'use client';

import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Send, Bot, User, Loader2, Wrench } from 'lucide-react';
import type { MCPTool, ToolCallResult } from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolCallResult;
  timestamp: Date;
  isLoading?: boolean;
}

interface ChatPanelProps {
  tools: MCPTool[];
  onCallTool: (name: string, args: Record<string, unknown>) => Promise<ToolCallResult>;
  disabled?: boolean;
  serverName?: string;
}

export const ChatPanel = memo(function ChatPanel({ tools, onCallTool, disabled, serverName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Parse tool call from user input (format: @toolName arg1=value1 arg2=value2)
  const parseToolCall = (input: string): { toolName: string; args: Record<string, unknown> } | null => {
    const match = input.match(/^@(\w+)\s*(.*)/);
    if (!match) return null;

    const toolName = match[1];
    const argsString = match[2].trim();

    // Check if tool exists
    if (!tools.find(t => t.name === toolName)) return null;

    const args: Record<string, unknown> = {};

    // Parse key=value pairs or JSON
    if (argsString.startsWith('{')) {
      try {
        return { toolName, args: JSON.parse(argsString) };
      } catch {
        return null;
      }
    }

    // Parse key=value format
    const pairs = argsString.match(/(\w+)=("[^"]*"|\S+)/g);
    if (pairs) {
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split('=');
        let value: unknown = valueParts.join('=');
        // Remove quotes if present
        if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        // Try to parse as JSON for numbers, booleans, etc
        try {
          value = JSON.parse(value as string);
        } catch {
          // Keep as string
        }
        args[key] = value;
      }
    }

    return { toolName, args };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing || disabled) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    // Check if it's a tool call
    const toolCall = parseToolCall(input);

    if (toolCall) {
      // Add loading message for tool
      const loadingMessage: Message = {
        id: crypto.randomUUID(),
        role: 'tool',
        content: '',
        toolName: toolCall.toolName,
        toolArgs: toolCall.args,
        timestamp: new Date(),
        isLoading: true,
      };

      setMessages(prev => [...prev, loadingMessage]);

      try {
        const result = await onCallTool(toolCall.toolName, toolCall.args);

        // Update the loading message with result
        setMessages(prev => prev.map(m =>
          m.id === loadingMessage.id
            ? { ...m, isLoading: false, toolResult: result, content: formatToolResult(result) }
            : m
        ));
      } catch (error) {
        setMessages(prev => prev.map(m =>
          m.id === loadingMessage.id
            ? { ...m, isLoading: false, content: `Error: ${error instanceof Error ? error.message : 'Tool call failed'}` }
            : m
        ));
      }
    } else {
      // Regular message - show help
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: getHelpMessage(),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }

    setIsProcessing(false);
  };

  const formatToolResult = (result: ToolCallResult): string => {
    return result.content
      .map(item => {
        if (item.type === 'text') return item.text;
        if (item.type === 'image') return '[Image]';
        return JSON.stringify(item);
      })
      .join('\n');
  };

  const getHelpMessage = (): string => {
    if (tools.length === 0) {
      return 'No tools available. Connect to an MCP server to access tools.';
    }
    return `To call a tool, use: @toolName arg1=value1 arg2=value2\n\nAvailable tools:\n${tools.map(t => `  @${t.name} - ${t.description || 'No description'}`).join('\n')}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--background-secondary)] rounded-xl border border-[var(--border)]">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)] pulse-glow" />
          <span className="font-medium text-sm">
            {serverName || 'MCP Chat'}
          </span>
        </div>
        <span className="text-xs text-[var(--foreground-muted)]">
          {tools.length} tools available
        </span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-12 h-12 text-[var(--foreground-muted)] mb-4" />
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-sm text-[var(--foreground-muted)] max-w-sm">
              Use <code className="px-1.5 py-0.5 bg-[var(--background-tertiary)] rounded text-[var(--accent)]">@toolName</code> to call MCP tools
            </p>
            {tools.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
                {tools.slice(0, 5).map(tool => (
                  <button
                    key={tool.name}
                    onClick={() => setInput(`@${tool.name} `)}
                    className="px-3 py-1.5 text-xs bg-[var(--background-tertiary)] hover:bg-[var(--border)] rounded-full text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  >
                    @{tool.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role !== 'user' && (
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                message.role === 'tool' ? 'bg-[var(--accent-muted)]' : 'bg-[var(--background-tertiary)]'
              }`}>
                {message.role === 'tool' ? (
                  <Wrench className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-[var(--foreground-muted)]" />
                )}
              </div>
            )}

            <div className={`max-w-[85%] md:max-w-[80%] min-w-0 ${message.role === 'user' ? 'order-first' : ''}`}>
              {message.role === 'tool' && message.toolName && (
                <div className="text-xs text-[var(--foreground-muted)] mb-1 flex flex-wrap items-center gap-1 overflow-hidden">
                  <span className="text-[var(--accent)] flex-shrink-0">@{message.toolName}</span>
                  {message.toolArgs && Object.keys(message.toolArgs).length > 0 && (
                    <span className="text-[var(--foreground-muted)] truncate">
                      ({Object.entries(message.toolArgs).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})
                    </span>
                  )}
                </div>
              )}

              <div className={`rounded-2xl px-4 py-2.5 ${
                message.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-br-md'
                  : message.role === 'tool'
                  ? message.toolResult?.isError
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400 rounded-bl-md'
                    : 'bg-[var(--background-tertiary)] border border-[var(--border)] rounded-bl-md'
                  : 'bg-[var(--background-tertiary)] border border-[var(--border)] rounded-bl-md'
              }`}>
                {message.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Executing...</span>
                  </div>
                ) : (
                  <pre className="text-sm whitespace-pre-wrap font-sans break-words overflow-x-auto">{message.content}</pre>
                )}
              </div>

              <div className="text-xs text-[var(--foreground-muted)] mt-1 px-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

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
            placeholder={disabled ? 'Connect to a server first...' : 'Type @toolName to call a tool...'}
            disabled={disabled || isProcessing}
            rows={1}
            className="w-full px-4 py-3 pr-12 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm placeholder:text-[var(--foreground-muted)]"
          />
          <button
            type="submit"
            disabled={disabled || isProcessing || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--accent)]"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </form>

        {!disabled && tools.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] overflow-x-auto scrollbar-none">
            <span className="flex-shrink-0">Quick:</span>
            {tools.slice(0, 3).map(tool => (
              <button
                key={tool.name}
                onClick={() => {
                  setInput(`@${tool.name} `);
                  inputRef.current?.focus();
                }}
                className="flex-shrink-0 px-2 py-0.5 bg-[var(--background-tertiary)] hover:bg-[var(--border)] rounded text-[var(--accent)] truncate max-w-[120px]"
              >
                @{tool.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
