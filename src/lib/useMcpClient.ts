'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ConnectionState,
  ConnectionStatus,
  MCPRequest,
  MCPResponse,
  MCPMessage,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPServerInfo,
  MCPCapabilities,
  OAuthCredentials,
  ToolCallResult,
} from './types';

const MCP_PROTOCOL_VERSION = '2024-11-05';

interface UseMcpClientOptions {
  onNotification?: (method: string, params: unknown) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

interface PendingRequest {
  resolve: (value: MCPResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export function useMcpClient(options: UseMcpClientOptions = {}) {
  const [state, setState] = useState<ConnectionState>({
    status: 'disconnected',
    tools: [],
    resources: [],
    prompts: [],
  });

  const serverUrlRef = useRef<string | null>(null);
  const credentialsRef = useRef<OAuthCredentials | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());
  const messageEndpointRef = useRef<string | null>(null);

  // Update connection status
  const setStatus = useCallback((status: ConnectionStatus, error?: string) => {
    setState(prev => ({ ...prev, status, error }));
    options.onConnectionChange?.(status);
  }, [options]);

  // Send a JSON-RPC notification (no response expected)
  const sendNotification = useCallback((method: string, params?: Record<string, unknown>) => {
    if (!serverUrlRef.current) {
      console.error('Cannot send notification: not connected');
      return;
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const targetUrl = messageEndpointRef.current || serverUrlRef.current!;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-mcp-server-url': targetUrl,
    };

    if (credentialsRef.current) {
      // Normalize token type to 'Bearer' (capitalized) as per RFC 6750
      const tokenType = (credentialsRef.current.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
      headers['Authorization'] = `${tokenType} ${credentialsRef.current.accessToken}`;
    }

    if (sessionIdRef.current) {
      headers['x-mcp-session-id'] = sessionIdRef.current;
    }

    console.log('Sending MCP notification:', method);

    fetch('/api/mcp/message', {
      method: 'POST',
      headers,
      body: JSON.stringify(notification),
    }).catch(error => {
      console.error('Failed to send notification:', error);
    });
  }, []);

  // Send a JSON-RPC request
  const sendRequest = useCallback(async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
    if (!serverUrlRef.current) {
      throw new Error('Not connected to server');
    }

    const id = uuidv4();
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequestsRef.current.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      pendingRequestsRef.current.set(id, {
        resolve: (response: MCPResponse) => {
          if (response.error) {
            reject(new Error(`${response.error.message} (code: ${response.error.code})`));
          } else {
            resolve(response.result);
          }
        },
        reject,
        timeout,
      });

      // Send message via proxy
      // Use the endpoint URL from the SSE stream if available, otherwise fall back to server URL
      const targetUrl = messageEndpointRef.current || serverUrlRef.current!;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-mcp-server-url': targetUrl,
      };

      if (credentialsRef.current) {
        // Normalize token type to 'Bearer' (capitalized) as per RFC 6750
        const tokenType = (credentialsRef.current.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
        headers['Authorization'] = `${tokenType} ${credentialsRef.current.accessToken}`;
      }

      if (sessionIdRef.current) {
        headers['x-mcp-session-id'] = sessionIdRef.current;
      }

      console.log('Sending MCP request:', method, 'to:', targetUrl);

      fetch('/api/mcp/message', {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      }).catch(error => {
        clearTimeout(timeout);
        pendingRequestsRef.current.delete(id);
        reject(error);
      });
    });
  }, []);

  // Handle incoming SSE messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as MCPMessage;

      // Check if it's a response (has id)
      if ('id' in data && data.id !== undefined) {
        const pending = pendingRequestsRef.current.get(String(data.id));
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRequestsRef.current.delete(String(data.id));
          pending.resolve(data as MCPResponse);
        }
      } else if ('method' in data) {
        // It's a notification
        options.onNotification?.(data.method, data.params);
      }
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  }, [options]);

  // Handle endpoint event (session initialization)
  const handleEndpoint = useCallback((event: MessageEvent) => {
    try {
      // The endpoint event contains the message endpoint URL
      const endpoint = event.data;
      console.log('Received endpoint event:', endpoint);
      if (endpoint) {
        // If endpoint is a relative path, make it absolute
        if (endpoint.startsWith('/')) {
          const baseUrl = serverUrlRef.current!.replace(/\/sse\/?$/, '');
          messageEndpointRef.current = `${baseUrl}${endpoint}`;
        } else {
          messageEndpointRef.current = endpoint;
        }
        console.log('Message endpoint set to:', messageEndpointRef.current);

        // Extract session ID if present in the endpoint
        if (messageEndpointRef.current) {
          const url = new URL(messageEndpointRef.current);
          const pathParts = url.pathname.split('/');
          const messageIndex = pathParts.indexOf('message');
          if (messageIndex > 0) {
            sessionIdRef.current = pathParts[messageIndex - 1];
            console.log('Session ID:', sessionIdRef.current);
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse endpoint event:', error);
    }
  }, []);

  // Connect to MCP server
  const connect = useCallback(async (serverUrl: string, credentials?: OAuthCredentials) => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    serverUrlRef.current = serverUrl;
    credentialsRef.current = credentials || null;
    setStatus('connecting');

    try {
      // Create SSE connection via proxy
      const sseUrl = new URL('/api/mcp/sse', window.location.origin);

      // We need to use a custom EventSource implementation to add headers
      // For now, we'll use fetch with streaming
      const headers: Record<string, string> = {
        'Accept': 'text/event-stream',
        'x-mcp-server-url': serverUrl,
      };

      if (credentials) {
        // Normalize token type to 'Bearer' (capitalized) as per RFC 6750
        const tokenType = (credentials.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
        headers['Authorization'] = `${tokenType} ${credentials.accessToken}`;
        console.log('SSE connect using auth:', `${tokenType} ${credentials.accessToken?.substring(0, 20)}...`);
      }

      const response = await fetch(sseUrl, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to connect: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete events
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let eventType = 'message';
            let eventData = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                eventData = line.slice(5).trim();
              } else if (line === '' && eventData) {
                // Empty line signals end of event
                if (eventType === 'endpoint') {
                  handleEndpoint({ data: eventData } as MessageEvent);
                } else if (eventType === 'message') {
                  handleMessage({ data: eventData } as MessageEvent);
                }
                eventType = 'message';
                eventData = '';
              }
            }
          }
        } catch (error) {
          if (state.status === 'connected') {
            setStatus('error', error instanceof Error ? error.message : 'Connection lost');
            options.onError?.(error instanceof Error ? error : new Error('Connection lost'));
          }
        }
      };

      // Start processing the stream (runs in background)
      processStream();

      // Wait for endpoint event (with timeout)
      const waitForEndpoint = async (timeoutMs: number = 10000): Promise<void> => {
        const startTime = Date.now();
        while (!messageEndpointRef.current) {
          if (Date.now() - startTime > timeoutMs) {
            throw new Error('Timeout waiting for session endpoint from server');
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      };

      console.log('Waiting for endpoint event...');
      await waitForEndpoint();
      console.log('Got endpoint, proceeding with initialization');

      // Initialize MCP connection
      setStatus('authenticating');

      const initResult = await sendRequest('initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          // SEP-1865: Advertise MCP Apps UI extension support
          extensions: {
            'io.modelcontextprotocol/ui': {
              mimeTypes: ['text/html;profile=mcp-app'],
            },
          },
        },
        clientInfo: {
          name: 'MCP Web Client',
          version: '1.0.0',
        },
      }) as {
        protocolVersion: string;
        capabilities: MCPCapabilities;
        serverInfo: MCPServerInfo;
      };

      // Send initialized notification (fire-and-forget, notifications don't get responses)
      sendNotification('notifications/initialized', {});

      // Fetch available tools, resources, and prompts based on server capabilities
      const capabilities = initResult.capabilities || {};
      console.log('Server capabilities:', JSON.stringify(capabilities));

      const promises: Promise<{ type: string; result: unknown }>[] = [];

      // Only call methods if server advertises the capability
      if (capabilities.tools) {
        promises.push(
          sendRequest('tools/list')
            .then(result => ({ type: 'tools', result }))
            .catch(() => ({ type: 'tools', result: { tools: [] } }))
        );
      }
      if (capabilities.resources) {
        promises.push(
          sendRequest('resources/list')
            .then(result => ({ type: 'resources', result }))
            .catch(() => ({ type: 'resources', result: { resources: [] } }))
        );
      }
      if (capabilities.prompts) {
        promises.push(
          sendRequest('prompts/list')
            .then(result => ({ type: 'prompts', result }))
            .catch(() => ({ type: 'prompts', result: { prompts: [] } }))
        );
      }

      const results = await Promise.all(promises);

      let tools: MCPTool[] = [];
      let resources: MCPResource[] = [];
      let prompts: MCPPrompt[] = [];

      for (const { type, result } of results) {
        if (type === 'tools') {
          tools = (result as { tools: MCPTool[] }).tools || [];
        } else if (type === 'resources') {
          resources = (result as { resources: MCPResource[] }).resources || [];
        } else if (type === 'prompts') {
          prompts = (result as { prompts: MCPPrompt[] }).prompts || [];
        }
      }

      setState(prev => ({
        ...prev,
        status: 'connected',
        serverUrl,
        serverInfo: initResult.serverInfo,
        capabilities: initResult.capabilities,
        tools,
        resources,
        prompts,
        error: undefined,
      }));

      options.onConnectionChange?.('connected');
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : 'Connection failed');
      options.onError?.(error instanceof Error ? error : new Error('Connection failed'));
      throw error;
    }
  }, [handleEndpoint, handleMessage, options, sendRequest, setStatus, state.status]);

  // Disconnect from server
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Clear pending requests
    for (const [id, pending] of pendingRequestsRef.current.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
      pendingRequestsRef.current.delete(id);
    }

    serverUrlRef.current = null;
    credentialsRef.current = null;
    sessionIdRef.current = null;
    messageEndpointRef.current = null;

    setState({
      status: 'disconnected',
      tools: [],
      resources: [],
      prompts: [],
    });
  }, []);

  // Call a tool
  const callTool = useCallback(async (name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> => {
    const result = await sendRequest('tools/call', {
      name,
      arguments: args,
    });
    return result as ToolCallResult;
  }, [sendRequest]);

  // Read a resource
  const readResource = useCallback(async (uri: string) => {
    return await sendRequest('resources/read', { uri });
  }, [sendRequest]);

  // Get a prompt
  const getPrompt = useCallback(async (name: string, args?: Record<string, string>) => {
    return await sendRequest('prompts/get', {
      name,
      arguments: args,
    });
  }, [sendRequest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      for (const pending of pendingRequestsRef.current.values()) {
        clearTimeout(pending.timeout);
      }
    };
  }, []);

  return {
    state,
    connect,
    disconnect,
    callTool,
    readResource,
    getPrompt,
    sendRequest,
  };
}
