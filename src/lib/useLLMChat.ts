'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ChatMessage,
  ToolCall,
  LLMSettings,
  MCPToolDefinition,
  LLMChatResponse,
  ToolResultContent,
} from './llm-types';

const CHAT_HISTORY_KEY = 'mcp-chat-history';

// Load chat history from localStorage
function loadChatHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Save chat history to localStorage
function saveChatHistory(messages: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    // Limit to last 100 messages to prevent localStorage from growing too large
    const toStore = messages.slice(-100);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage errors
  }
}

interface UseLLMChatOptions {
  settings: LLMSettings;
  tools?: MCPToolDefinition[];
  onToolCall?: (toolCall: ToolCall) => Promise<unknown>;
}

interface UseLLMChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
}

export function useLLMChat({ settings, tools, onToolCall }: UseLLMChatOptions): UseLLMChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat history on mount
  useEffect(() => {
    const stored = loadChatHistory();
    if (stored.length > 0) {
      setMessages(stored);
    }
    setIsInitialized(true);
  }, []);

  // Save chat history when messages change
  useEffect(() => {
    if (isInitialized && messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages, isInitialized]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    // Also clear from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CHAT_HISTORY_KEY);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!settings.activeProvider) {
      setError('No LLM provider selected. Please configure one in settings.');
      return;
    }

    const config = settings.providers[settings.activeProvider];
    if (!config) {
      setError('Provider configuration not found.');
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      let currentMessages = [...messages, userMessage];
      let continueLoop = true;

      while (continueLoop) {
        const response = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: settings.activeProvider,
            model: config.model,
            messages: currentMessages,
            tools,
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            systemPrompt: settings.systemPrompt || getDefaultSystemPrompt(tools),
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Request failed: ${response.status}`);
        }

        const data: LLMChatResponse = await response.json();
        const assistantMessage = data.message;

        // Add assistant message to state
        setMessages(prev => [...prev, assistantMessage]);
        currentMessages = [...currentMessages, assistantMessage];

        // Check if there are tool calls to process
        if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0 && onToolCall) {
          // Process each tool call
          for (const toolCall of assistantMessage.toolCalls) {
            // Look up the serverId from the tools list
            const toolDef = tools?.find(t => t.name === toolCall.name);
            const toolCallWithServer = { ...toolCall, serverId: toolDef?.serverId };

            // Update tool call status to running
            setMessages(prev => prev.map(m =>
              m.id === assistantMessage.id && m.toolCalls
                ? {
                    ...m,
                    toolCalls: m.toolCalls?.map(tc =>
                      tc.id === toolCall.id ? { ...tc, status: 'running' as const } : tc
                    ),
                  }
                : m
            ));

            try {
              // Execute the tool with server routing
              const result = await onToolCall(toolCallWithServer);

              // Update tool call with result
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id && m.toolCalls
                  ? {
                      ...m,
                      toolCalls: m.toolCalls?.map(tc =>
                        tc.id === toolCall.id
                          ? { ...tc, status: 'completed' as const, result }
                          : tc
                      ),
                    }
                  : m
              ));

              // Extract content for LLM and preserve full content for UI rendering
              const mcpResult = result as { content?: ToolResultContent[]; isError?: boolean };
              const contentItems = mcpResult.content || [];

              // Format text content for LLM
              const textContent = contentItems
                .map(item => {
                  if (item.type === 'text') return item.text || '';
                  if (item.type === 'resource' && item.resource?.text) {
                    // For UI resources, just tell the LLM it's rendered
                    if (item.resource.mimeType?.includes('html')) {
                      return '[UI Resource rendered in chat]';
                    }
                    return item.resource.text;
                  }
                  if (item.type === 'image') return '[Image]';
                  return JSON.stringify(item);
                })
                .join('\n');

              // Add tool result message with both text for LLM and full content for rendering
              const toolResultMessage: ChatMessage = {
                id: uuidv4(),
                role: 'tool',
                content: textContent || JSON.stringify(result),
                timestamp: Date.now(),
                toolCallId: toolCall.id,
                toolResultContent: contentItems.length > 0 ? contentItems : undefined,
              };

              setMessages(prev => [...prev, toolResultMessage]);
              currentMessages = [...currentMessages, toolResultMessage];
            } catch (toolError) {
              // Update tool call with error
              const errorMessage = toolError instanceof Error ? toolError.message : 'Tool execution failed';

              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id && m.toolCalls
                  ? {
                      ...m,
                      toolCalls: m.toolCalls?.map(tc =>
                        tc.id === toolCall.id
                          ? { ...tc, status: 'error' as const, error: errorMessage }
                          : tc
                      ),
                    }
                  : m
              ));

              // Add error tool result message
              const toolErrorMessage: ChatMessage = {
                id: uuidv4(),
                role: 'tool',
                content: JSON.stringify({ error: errorMessage }),
                timestamp: Date.now(),
                toolCallId: toolCall.id,
              };

              setMessages(prev => [...prev, toolErrorMessage]);
              currentMessages = [...currentMessages, toolErrorMessage];
            }
          }
          // Continue the loop to get the assistant's response after tool execution
        } else {
          // No tool calls, we're done
          continueLoop = false;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't show error
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);

      // Add error message
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          error: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [settings, messages, tools, onToolCall]);

  const retryLastMessage = useCallback(async () => {
    // Find the last user message
    const lastUserMessageIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserMessageIndex === -1) return;

    const lastUserMessage = messages[lastUserMessageIndex];

    // Remove all messages after the last user message
    setMessages(prev => prev.slice(0, lastUserMessageIndex));

    // Resend the message
    await sendMessage(lastUserMessage.content);
  }, [messages, sendMessage]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage,
  };
}

function getDefaultSystemPrompt(tools?: MCPToolDefinition[]): string {
  let prompt = `You are a helpful AI assistant integrated with MCP (Model Context Protocol) servers. You can help users interact with connected MCP servers and their tools.`;

  if (tools && tools.length > 0) {
    prompt += `\n\nYou have access to the following tools from connected MCP servers. Use them when appropriate to help the user:\n`;
    for (const tool of tools) {
      prompt += `\n- ${tool.name}${tool.serverName ? ` (from ${tool.serverName})` : ''}: ${tool.description || 'No description'}`;
    }
  }

  prompt += `\n\nWhen using tools, explain what you're doing and interpret the results for the user.`;

  return prompt;
}
