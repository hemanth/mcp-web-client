'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
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
  ServerInstance,
  TransportType,
  SamplingRequest,
  CreateMessageRequestParams,
  CreateMessageResult,
  ElicitationRequest,
  ElicitRequestParams,
  ElicitResult,
} from './types';

// Helper to normalize resource - some servers swap name/uri
function normalizeResource(resource: MCPResource): MCPResource {
  // Check if name looks like a URI and uri doesn't
  const nameIsUri = resource.name.includes('://') || resource.name.startsWith('/');
  const uriIsUri = resource.uri.includes('://') || resource.uri.startsWith('/');

  if (nameIsUri && !uriIsUri) {
    // Swap name and uri for display purposes
    // Note: reading may fail if server registered with wrong argument order
    return {
      ...resource,
      uri: resource.name,
      name: resource.uri,
    };
  }
  return resource;
}

const MCP_PROTOCOL_VERSION = '2024-11-05';
const STORAGE_KEY = 'mcp-servers';

// Detect transport type based on URL pattern
function detectTransportType(url: string): TransportType {
  // URLs ending with /sse typically use SSE transport
  if (url.endsWith('/sse') || url.includes('/sse?')) {
    return 'sse';
  }
  // Otherwise assume Streamable HTTP transport
  return 'streamable-http';
}

interface UseMultiServerMcpOptions {
  onNotification?: (serverId: string, method: string, params: unknown) => void;
  onServerChange?: (serverId: string, status: ConnectionStatus) => void;
  onError?: (serverId: string, error: Error) => void;
  onSamplingRequest?: (request: SamplingRequest) => void;
  onElicitationRequest?: (request: ElicitationRequest) => void;
}

interface ServerConnection {
  serverUrl: string;
  transport: TransportType;
  credentials: OAuthCredentials | null;
  customHeaders: Record<string, string> | null;
  sessionId: string | null;
  messageEndpoint: string | null;
  pendingRequests: Map<string, {
    resolve: (value: MCPResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
  abortController: AbortController | null;
}

interface StoredServer {
  id: string;
  url: string;
  name: string;
  credentials?: OAuthCredentials;
  customHeaders?: Record<string, string>;
  wasConnected?: boolean; // Track if server was connected before page refresh
}

// Load servers from localStorage
function loadStoredServers(): (ServerInstance & { wasConnected?: boolean })[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsedServers: StoredServer[] = JSON.parse(stored);
    return parsedServers.map(s => ({
      ...s,
      status: 'disconnected' as ConnectionStatus,
      tools: [],
      resources: [],
      prompts: [],
      wasConnected: s.wasConnected,
      customHeaders: s.customHeaders,
    }));
  } catch {
    return [];
  }
}

// Save servers to localStorage
function saveServers(servers: ServerInstance[]) {
  if (typeof window === 'undefined') return;
  try {
    const toStore: StoredServer[] = servers.map(s => ({
      id: s.id,
      url: s.url,
      name: s.name,
      credentials: s.credentials,
      customHeaders: s.customHeaders,
      wasConnected: s.status === 'connected', // Remember connection state
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage errors
  }
}

export function useMultiServerMcp(options: UseMultiServerMcpOptions = {}) {
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const connectionsRef = useRef<Map<string, ServerConnection>>(new Map());
  const autoConnectAttemptedRef = useRef<Set<string>>(new Set());
  const serversToAutoConnectRef = useRef<Set<string>>(new Set()); // Track servers that should auto-connect

  // Load servers from localStorage on mount
  useEffect(() => {
    const stored = loadStoredServers();
    if (stored.length > 0) {
      // Track which servers were previously connected for auto-reconnect
      for (const s of stored) {
        if (s.wasConnected) {
          serversToAutoConnectRef.current.add(s.id);
        }
      }
      setServers(stored);
      setActiveServerId(stored[0].id);
    }
    setIsInitialized(true);
  }, []);

  // Save servers to localStorage when they change
  useEffect(() => {
    if (isInitialized) {
      saveServers(servers);
    }
  }, [servers, isInitialized]);

  // Get the active server
  const activeServer = servers.find(s => s.id === activeServerId);

  // Update a server's state
  const updateServer = useCallback((serverId: string, updates: Partial<ServerInstance>) => {
    setServers(prev => prev.map(s =>
      s.id === serverId ? { ...s, ...updates } : s
    ));
  }, []);

  // Send a JSON-RPC notification (no response expected)
  const sendNotification = useCallback((serverId: string, method: string, params?: Record<string, unknown>) => {
    const connection = connectionsRef.current.get(serverId);
    if (!connection) {
      console.error('Cannot send notification: server not found');
      return;
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const targetUrl = connection.messageEndpoint || connection.serverUrl;
    const apiEndpoint = connection.transport === 'streamable-http'
      ? '/api/mcp/streamable'
      : '/api/mcp/message';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-mcp-server-url': targetUrl,
    };

    if (connection.credentials) {
      // Normalize token type to 'Bearer' (capitalized) as per RFC 6750
      const tokenType = (connection.credentials.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
      headers['Authorization'] = `${tokenType} ${connection.credentials.accessToken}`;
    }

    if (connection.sessionId) {
      headers['x-mcp-session-id'] = connection.sessionId;
    }

    // Pass custom headers as JSON-encoded header
    if (connection.customHeaders && Object.keys(connection.customHeaders).length > 0) {
      headers['x-mcp-custom-headers'] = JSON.stringify(connection.customHeaders);
    }

    console.log(`[${serverId}] Sending MCP notification:`, method);

    fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(notification),
    }).catch(error => {
      console.error('Failed to send notification:', error);
    });
  }, []);

  // Send a JSON-RPC request to a specific server
  const sendRequest = useCallback(async (serverId: string, method: string, params?: Record<string, unknown>): Promise<unknown> => {
    const connection = connectionsRef.current.get(serverId);
    if (!connection) {
      throw new Error('Server not found');
    }

    const id = uuidv4();
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    // For Streamable HTTP, send request and wait for direct response
    if (connection.transport === 'streamable-http') {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-mcp-server-url': connection.serverUrl,
      };

      if (connection.credentials) {
        const tokenType = (connection.credentials.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
        headers['Authorization'] = `${tokenType} ${connection.credentials.accessToken}`;
      }

      if (connection.sessionId) {
        headers['x-mcp-session-id'] = connection.sessionId;
      }

      // Pass custom headers as JSON-encoded header
      if (connection.customHeaders && Object.keys(connection.customHeaders).length > 0) {
        headers['x-mcp-custom-headers'] = JSON.stringify(connection.customHeaders);
      }

      console.log(`[${serverId}] Sending Streamable HTTP request:`, method, 'sessionId:', connection.sessionId);

      const response = await fetch('/api/mcp/streamable', {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      // Capture session ID from response
      const responseSessionId = response.headers.get('mcp-session-id');
      console.log(`[${serverId}] Response session ID:`, responseSessionId, 'current:', connection.sessionId);
      if (responseSessionId) {
        connection.sessionId = responseSessionId;
        console.log(`[${serverId}] Session ID updated to:`, connection.sessionId);
      }

      const contentType = response.headers.get('content-type') || '';

      // Handle SSE responses (streaming)
      if (contentType.includes('text/event-stream') && response.body) {
        return new Promise((resolve, reject) => {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          const processStream = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.startsWith('data:')) {
                    const data = line.slice(5).trim();
                    if (data) {
                      try {
                        const parsed = JSON.parse(data) as MCPMessage;

                        // Check if this is a request FROM the server (sampling/elicitation)
                        if ('method' in parsed && 'id' in parsed) {
                          const server = servers.find(s => s.id === serverId);
                          const serverName = server?.name || 'Unknown Server';

                          if (parsed.method === 'sampling/createMessage') {
                            const samplingRequest: SamplingRequest = {
                              id: parsed.id,
                              serverId,
                              serverName,
                              params: parsed.params as unknown as CreateMessageRequestParams,
                              timestamp: Date.now(),
                            };
                            options.onSamplingRequest?.(samplingRequest);
                          } else if (parsed.method === 'elicitation/create') {
                            const elicitationRequest: ElicitationRequest = {
                              id: parsed.id,
                              serverId,
                              serverName,
                              params: parsed.params as unknown as ElicitRequestParams,
                              timestamp: Date.now(),
                            };
                            options.onElicitationRequest?.(elicitationRequest);
                          }
                          continue;
                        }

                        // Check if this is a response to our request
                        if ('id' in parsed && String(parsed.id) === id) {
                          const resp = parsed as MCPResponse;
                          if (resp.error) {
                            reject(new Error(`${resp.error.message} (code: ${resp.error.code})`));
                          } else {
                            resolve(resp.result);
                          }
                          return;
                        }
                      } catch {
                        // Continue reading
                      }
                    }
                  }
                }
              }
              reject(new Error('Stream ended without response'));
            } catch (error) {
              reject(error);
            }
          };

          processStream();
        });
      }

      // Handle JSON responses
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`${data.error.message} (code: ${data.error.code})`);
      }
      return data.result;
    }

    // For SSE transport, use pending requests map
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      connection.pendingRequests.set(id, {
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

      const targetUrl = connection.messageEndpoint || connection.serverUrl;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-mcp-server-url': targetUrl,
      };

      if (connection.credentials) {
        // Normalize token type to 'Bearer' (capitalized) as per RFC 6750
        const tokenType = (connection.credentials.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
        headers['Authorization'] = `${tokenType} ${connection.credentials.accessToken}`;
      }

      if (connection.sessionId) {
        headers['x-mcp-session-id'] = connection.sessionId;
      }

      // Pass custom headers as JSON-encoded header
      if (connection.customHeaders && Object.keys(connection.customHeaders).length > 0) {
        headers['x-mcp-custom-headers'] = JSON.stringify(connection.customHeaders);
      }

      console.log(`[${serverId}] Sending MCP request:`, method, 'to:', targetUrl);

      fetch('/api/mcp/message', {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      }).catch(error => {
        clearTimeout(timeout);
        connection.pendingRequests.delete(id);
        reject(error);
      });
    });
  }, [servers, options]);

  // Handle incoming SSE messages for a server
  const createMessageHandler = useCallback((serverId: string) => {
    return (eventData: string) => {
      try {
        const data = JSON.parse(eventData) as MCPMessage;
        const connection = connectionsRef.current.get(serverId);

        if ('id' in data && data.id !== undefined) {
          // Check if this is a request FROM the server (sampling/elicitation)
          if ('method' in data) {
            const server = servers.find(s => s.id === serverId);
            const serverName = server?.name || 'Unknown Server';

            if (data.method === 'sampling/createMessage') {
              // Server is requesting LLM sampling
              const samplingRequest: SamplingRequest = {
                id: data.id,
                serverId,
                serverName,
                params: data.params as unknown as CreateMessageRequestParams,
                timestamp: Date.now(),
              };
              options.onSamplingRequest?.(samplingRequest);
            } else if (data.method === 'elicitation/create') {
              // Server is requesting user input
              const elicitationRequest: ElicitationRequest = {
                id: data.id,
                serverId,
                serverName,
                params: data.params as unknown as ElicitRequestParams,
                timestamp: Date.now(),
              };
              options.onElicitationRequest?.(elicitationRequest);
            }
            return;
          }

          // This is a response to our request
          const pending = connection?.pendingRequests.get(String(data.id));
          if (pending) {
            clearTimeout(pending.timeout);
            connection?.pendingRequests.delete(String(data.id));
            pending.resolve(data as MCPResponse);
          }
        } else if ('method' in data) {
          options.onNotification?.(serverId, data.method, data.params);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };
  }, [options, servers]);

  // Handle endpoint event for a server
  const createEndpointHandler = useCallback((serverId: string) => {
    return (endpoint: string) => {
      const connection = connectionsRef.current.get(serverId);
      if (!connection) return;

      console.log(`[${serverId}] Received endpoint event:`, endpoint);

      if (endpoint.startsWith('/')) {
        const baseUrl = connection.serverUrl.replace(/\/sse\/?$/, '');
        connection.messageEndpoint = `${baseUrl}${endpoint}`;
      } else {
        connection.messageEndpoint = endpoint;
      }

      console.log(`[${serverId}] Message endpoint set to:`, connection.messageEndpoint);

      // Extract session ID
      try {
        const url = new URL(connection.messageEndpoint);
        const pathParts = url.pathname.split('/');
        const messageIndex = pathParts.indexOf('message');
        if (messageIndex > 0) {
          connection.sessionId = pathParts[messageIndex - 1];
          console.log(`[${serverId}] Session ID:`, connection.sessionId);
        }
      } catch (e) {
        console.error('Failed to parse endpoint URL:', e);
      }
    };
  }, []);

  // Add a new server
  const addServer = useCallback(async (
    url: string,
    name?: string,
    credentials?: OAuthCredentials,
    explicitTransport?: TransportType,
    customHeaders?: Record<string, string>
  ): Promise<string> => {
    const serverId = uuidv4();

    let serverName = name;
    if (!serverName) {
      try {
        serverName = new URL(url).hostname;
      } catch {
        serverName = url;
      }
    }

    const newServer: ServerInstance = {
      id: serverId,
      url,
      name: serverName,
      status: 'disconnected',
      tools: [],
      resources: [],
      prompts: [],
      credentials,
      transport: explicitTransport,
      customHeaders,
    };

    setServers(prev => {
      const updated = [...prev, newServer];
      // Set as active if it's the first server
      if (updated.length === 1) {
        setActiveServerId(serverId);
      }
      return updated;
    });

    return serverId;
  }, []);

  // Connect to a server
  const connectServer = useCallback(async (serverId: string, credentials?: OAuthCredentials) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    // Use stored transport if explicitly set, otherwise auto-detect from URL
    const transport = server.transport || detectTransportType(server.url);

    // Create connection state
    const connection: ServerConnection = {
      serverUrl: server.url,
      transport,
      credentials: credentials || server.credentials || null,
      customHeaders: server.customHeaders || null,
      sessionId: null,
      messageEndpoint: null,
      pendingRequests: new Map(),
      abortController: new AbortController(),
    };

    connectionsRef.current.set(serverId, connection);
    updateServer(serverId, { status: 'connecting', credentials, transport });
    options.onServerChange?.(serverId, 'connecting');

    try {
      // For Streamable HTTP transport, go directly to initialization
      if (transport === 'streamable-http') {
        console.log(`[${serverId}] Using Streamable HTTP transport`);
        updateServer(serverId, { status: 'authenticating' });
      } else {
        // For SSE transport, establish SSE connection first
        console.log(`[${serverId}] Using SSE transport`);
        const sseUrl = new URL('/api/mcp/sse', window.location.origin);
        const headers: Record<string, string> = {
          'Accept': 'text/event-stream',
          'x-mcp-server-url': server.url,
        };

        if (connection.credentials) {
          // Normalize token type to 'Bearer' (capitalized) as per RFC 6750
          const tokenType = (connection.credentials.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
          headers['Authorization'] = `${tokenType} ${connection.credentials.accessToken}`;
        }

        // Pass custom headers as JSON-encoded header
        if (connection.customHeaders && Object.keys(connection.customHeaders).length > 0) {
          headers['x-mcp-custom-headers'] = JSON.stringify(connection.customHeaders);
        }

        const response = await fetch(sseUrl, {
          headers,
          signal: connection.abortController?.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to connect: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handleMessage = createMessageHandler(serverId);
        const handleEndpoint = createEndpointHandler(serverId);

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

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
                  if (eventType === 'endpoint') {
                    handleEndpoint(eventData);
                  } else if (eventType === 'message') {
                    handleMessage(eventData);
                  }
                  eventType = 'message';
                  eventData = '';
                }
              }
            }
          } catch (error) {
            if (!(error instanceof Error && error.name === 'AbortError')) {
              const currentServer = servers.find(s => s.id === serverId);
              if (currentServer?.status === 'connected') {
                updateServer(serverId, { status: 'error', error: 'Connection lost' });
                options.onError?.(serverId, new Error('Connection lost'));
              }
            }
          }
        };

        processStream();

        // Wait for endpoint
        const waitForEndpoint = async (timeoutMs: number = 10000): Promise<void> => {
          const startTime = Date.now();
          while (!connection.messageEndpoint) {
            if (Date.now() - startTime > timeoutMs) {
              throw new Error('Timeout waiting for session endpoint');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        };

        await waitForEndpoint();

        updateServer(serverId, { status: 'authenticating' });
      }

      const initResult = await sendRequest(serverId, 'initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          // Sampling: Allow servers to request LLM completions
          sampling: {},
          // Elicitation: Allow servers to request user input
          elicitation: {
            form: {},
          },
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

      sendNotification(serverId, 'notifications/initialized', {});

      const capabilities = initResult.capabilities || {};
      const promises: Promise<{ type: string; result: unknown }>[] = [];

      if (capabilities.tools) {
        promises.push(
          sendRequest(serverId, 'tools/list')
            .then(result => ({ type: 'tools', result }))
            .catch(() => ({ type: 'tools', result: { tools: [] } }))
        );
      }
      if (capabilities.resources) {
        promises.push(
          sendRequest(serverId, 'resources/list')
            .then(result => ({ type: 'resources', result }))
            .catch(() => ({ type: 'resources', result: { resources: [] } }))
        );
      }
      if (capabilities.prompts) {
        promises.push(
          sendRequest(serverId, 'prompts/list')
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
          const rawResources = (result as { resources: MCPResource[] }).resources || [];
          resources = rawResources.map(normalizeResource);
        } else if (type === 'prompts') {
          prompts = (result as { prompts: MCPPrompt[] }).prompts || [];
        }
      }

      updateServer(serverId, {
        status: 'connected',
        serverInfo: initResult.serverInfo,
        capabilities: initResult.capabilities,
        tools,
        resources,
        prompts,
        error: undefined,
      });

      // Auto-select if first connected server
      if (!activeServerId) {
        setActiveServerId(serverId);
      }

      options.onServerChange?.(serverId, 'connected');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      updateServer(serverId, { status: 'error', error: errorMessage });
      options.onError?.(serverId, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }, [servers, activeServerId, updateServer, sendRequest, sendNotification, createMessageHandler, createEndpointHandler, options]);

  // Disconnect a server
  const disconnectServer = useCallback((serverId: string) => {
    const connection = connectionsRef.current.get(serverId);

    if (connection) {
      connection.abortController?.abort();

      for (const [id, pending] of connection.pendingRequests.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Disconnected'));
        connection.pendingRequests.delete(id);
      }

      connectionsRef.current.delete(serverId);
    }

    updateServer(serverId, {
      status: 'disconnected',
      tools: [],
      resources: [],
      prompts: [],
      serverInfo: undefined,
      capabilities: undefined,
      error: undefined,
    });

    // Select another server if this was active
    if (activeServerId === serverId) {
      const connectedServers = servers.filter(s => s.id !== serverId && s.status === 'connected');
      setActiveServerId(connectedServers[0]?.id || null);
    }
  }, [servers, activeServerId, updateServer]);

  // Remove a server
  const removeServer = useCallback((serverId: string) => {
    disconnectServer(serverId);
    setServers(prev => prev.filter(s => s.id !== serverId));

    if (activeServerId === serverId) {
      setActiveServerId(null);
    }
  }, [activeServerId, disconnectServer]);

  // Edit a server's URL, name, and custom headers
  const editServer = useCallback((serverId: string, url: string, name?: string, customHeaders?: Record<string, string>) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    // If server is connected and URL changed, disconnect first
    if (server.status === 'connected' && server.url !== url) {
      disconnectServer(serverId);
    }

    let serverName = name;
    if (!serverName) {
      try {
        serverName = new URL(url).hostname;
      } catch {
        serverName = url;
      }
    }

    setServers(prev => prev.map(s =>
      s.id === serverId ? { ...s, url, name: serverName!, customHeaders } : s
    ));
  }, [servers, disconnectServer]);

  // Call a tool on the active server
  const callTool = useCallback(async (name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> => {
    if (!activeServerId) {
      throw new Error('No active server');
    }
    const result = await sendRequest(activeServerId, 'tools/call', {
      name,
      arguments: args,
    });
    return result as ToolCallResult;
  }, [activeServerId, sendRequest]);

  // Call a tool on a specific server
  const callToolOnServer = useCallback(async (serverId: string, name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> => {
    const result = await sendRequest(serverId, 'tools/call', {
      name,
      arguments: args,
    });
    return result as ToolCallResult;
  }, [sendRequest]);

  // Read a resource from the active server
  const readResource = useCallback(async (uri: string) => {
    if (!activeServerId) {
      throw new Error('No active server');
    }
    return await sendRequest(activeServerId, 'resources/read', { uri });
  }, [activeServerId, sendRequest]);

  // Get a prompt from the active server
  const getPrompt = useCallback(async (name: string, args?: Record<string, string>) => {
    if (!activeServerId) {
      throw new Error('No active server');
    }
    return await sendRequest(activeServerId, 'prompts/get', {
      name,
      arguments: args,
    });
  }, [activeServerId, sendRequest]);

  // Get aggregated data across all connected servers
  const getAllTools = useCallback(() => {
    return servers
      .filter(s => s.status === 'connected')
      .flatMap(s => s.tools.map(t => ({ ...t, serverId: s.id, serverName: s.name })));
  }, [servers]);

  const getAllResources = useCallback(() => {
    return servers
      .filter(s => s.status === 'connected')
      .flatMap(s => s.resources.map(r => ({ ...r, serverId: s.id, serverName: s.name })));
  }, [servers]);

  const getAllPrompts = useCallback(() => {
    return servers
      .filter(s => s.status === 'connected')
      .flatMap(s => s.prompts.map(p => ({ ...p, serverId: s.id, serverName: s.name })));
  }, [servers]);

  // Respond to a sampling request from a server
  const respondToSamplingRequest = useCallback(async (
    serverId: string,
    requestId: string | number,
    result: CreateMessageResult | { error: { code: number; message: string } }
  ) => {
    const connection = connectionsRef.current.get(serverId);
    if (!connection) {
      console.error('No connection found for server:', serverId);
      return;
    }

    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: requestId,
      ...('error' in result ? { error: result.error } : { result }),
    };

    const targetUrl = connection.messageEndpoint || connection.serverUrl;
    const apiEndpoint = connection.transport === 'streamable-http'
      ? '/api/mcp/streamable'
      : '/api/mcp/message';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-mcp-server-url': targetUrl,
    };

    if (connection.credentials) {
      const tokenType = (connection.credentials.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
      headers['Authorization'] = `${tokenType} ${connection.credentials.accessToken}`;
    }

    if (connection.sessionId) {
      headers['x-mcp-session-id'] = connection.sessionId;
    }

    if (connection.customHeaders && Object.keys(connection.customHeaders).length > 0) {
      headers['x-mcp-custom-headers'] = JSON.stringify(connection.customHeaders);
    }

    console.log(`[${serverId}] Sending sampling response for request:`, requestId);

    await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(response),
    });
  }, []);

  // Respond to an elicitation request from a server
  const respondToElicitationRequest = useCallback(async (
    serverId: string,
    requestId: string | number,
    result: ElicitResult
  ) => {
    const connection = connectionsRef.current.get(serverId);
    if (!connection) {
      console.error('No connection found for server:', serverId);
      return;
    }

    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: requestId,
      result,
    };

    const targetUrl = connection.messageEndpoint || connection.serverUrl;
    const apiEndpoint = connection.transport === 'streamable-http'
      ? '/api/mcp/streamable'
      : '/api/mcp/message';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-mcp-server-url': targetUrl,
    };

    if (connection.credentials) {
      const tokenType = (connection.credentials.tokenType || 'Bearer').replace(/^bearer$/i, 'Bearer');
      headers['Authorization'] = `${tokenType} ${connection.credentials.accessToken}`;
    }

    if (connection.sessionId) {
      headers['x-mcp-session-id'] = connection.sessionId;
    }

    if (connection.customHeaders && Object.keys(connection.customHeaders).length > 0) {
      headers['x-mcp-custom-headers'] = JSON.stringify(connection.customHeaders);
    }

    console.log(`[${serverId}] Sending elicitation response for request:`, requestId);

    await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(response),
    });
  }, []);

  // Auto-connect servers that were previously connected on page load
  useEffect(() => {
    if (!isInitialized) return;

    // Small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      for (const server of servers) {
        // Only auto-connect if:
        // 1. Server was previously connected OR has credentials
        // 2. Server is not already connected/connecting
        // 3. We haven't already attempted auto-connect for this server
        const shouldAutoConnect = serversToAutoConnectRef.current.has(server.id) || server.credentials;

        if (
          shouldAutoConnect &&
          server.status === 'disconnected' &&
          !autoConnectAttemptedRef.current.has(server.id)
        ) {
          autoConnectAttemptedRef.current.add(server.id);
          connectServer(server.id, server.credentials).catch(() => {
            // Silently ignore auto-connect failures
            // User can manually reconnect if needed
          });
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isInitialized, servers, connectServer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const [, connection] of connectionsRef.current) {
        connection.abortController?.abort();
        for (const pending of connection.pendingRequests.values()) {
          clearTimeout(pending.timeout);
        }
      }
    };
  }, []);

  return {
    servers,
    activeServerId,
    activeServer,
    setActiveServerId,
    addServer,
    connectServer,
    disconnectServer,
    removeServer,
    editServer,
    callTool,
    callToolOnServer,
    readResource,
    getPrompt,
    getAllTools,
    getAllResources,
    getAllPrompts,
    respondToSamplingRequest,
    respondToElicitationRequest,
  };
}
