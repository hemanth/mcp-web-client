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
  MCPResourceTemplate,
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
  MCPProgressNotification,
  MCPLogMessage,
  MCPCompletionResult,
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

const MCP_PROTOCOL_VERSION = '2025-06-18';
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
  onProgress?: (serverId: string, progress: MCPProgressNotification) => void;
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
      resourceTemplates: [],
      prompts: [],
      wasConnected: s.wasConnected,
      customHeaders: s.customHeaders,
      logMessages: [],
      activeProgress: new Map(),
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
  const serversToAutoConnectRef = useRef<Set<string>>(new Set());
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  const reconnectTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

  // Send a JSON-RPC response back to the server (for server-initiated requests like ping, roots/list)
  const sendServerResponse = useCallback((serverId: string, requestId: string | number, result: unknown) => {
    const connection = connectionsRef.current.get(serverId);
    if (!connection) {
      console.error('Cannot send response: server not found');
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

    console.log(`[${serverId}] Sending response for server request:`, requestId);

    fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(response),
    }).catch(error => {
      console.error('Failed to send response:', error);
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

                        // Check if this is a request FROM the server (sampling/elicitation/ping/roots)
                        if ('method' in parsed && 'id' in parsed) {
                          const server = servers.find(s => s.id === serverId);
                          const serverName = server?.name || 'Unknown Server';

                          if (parsed.method === 'ping') {
                            // Respond to server ping
                            sendServerResponse(serverId, parsed.id as string | number, {});
                          } else if (parsed.method === 'roots/list') {
                            // Respond with empty roots (browser-based client)
                            sendServerResponse(serverId, parsed.id as string | number, { roots: [] });
                          } else if (parsed.method === 'sampling/createMessage') {
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

                        // Check if this is a notification (no id, has method)
                        if ('method' in parsed && !('id' in parsed)) {
                          handleNotification(serverId, (parsed as { method: string; params?: Record<string, unknown> }).method, (parsed as { params?: Record<string, unknown> }).params);
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

  // Fetch all items from a paginated list endpoint
  const fetchAllWithPagination = useCallback(async (serverId: string, method: string, itemsKey: string): Promise<unknown[]> => {
    let allItems: unknown[] = [];
    let cursor: string | undefined;

    do {
      const params: Record<string, unknown> = {};
      if (cursor) {
        params.cursor = cursor;
      }

      const result = await sendRequest(serverId, method, Object.keys(params).length > 0 ? params : undefined) as Record<string, unknown>;
      const items = (result[itemsKey] as unknown[]) || [];
      allItems = allItems.concat(items);
      cursor = result.nextCursor as string | undefined;
    } while (cursor);

    return allItems;
  }, [sendRequest]);

  // Handle notifications from the server (list-changed, progress, logging, cancellation, resource updates)
  const handleNotification = useCallback((serverId: string, method: string, params?: Record<string, unknown>) => {
    const connection = connectionsRef.current.get(serverId);

    if (method === 'notifications/tools/list_changed') {
      // Re-fetch tools list
      sendRequest(serverId, 'tools/list').then(result => {
        const tools = (result as { tools: MCPTool[] }).tools || [];
        updateServer(serverId, { tools });
      }).catch(err => console.error(`[${serverId}] Failed to re-fetch tools:`, err));
    } else if (method === 'notifications/resources/list_changed') {
      // Re-fetch resources list
      sendRequest(serverId, 'resources/list').then(result => {
        const rawResources = (result as { resources: MCPResource[] }).resources || [];
        const resources = rawResources.map(normalizeResource);
        updateServer(serverId, { resources });
      }).catch(err => console.error(`[${serverId}] Failed to re-fetch resources:`, err));
    } else if (method === 'notifications/prompts/list_changed') {
      // Re-fetch prompts list
      sendRequest(serverId, 'prompts/list').then(result => {
        const prompts = (result as { prompts: MCPPrompt[] }).prompts || [];
        updateServer(serverId, { prompts });
      }).catch(err => console.error(`[${serverId}] Failed to re-fetch prompts:`, err));
    } else if (method === 'notifications/resources/updated') {
      // A subscribed resource was updated — re-read it and notify
      const uri = params?.uri as string | undefined;
      if (uri) {
        sendRequest(serverId, 'resources/read', { uri }).then(result => {
          options.onNotification?.(serverId, method, { uri, ...result as Record<string, unknown> });
        }).catch(err => console.error(`[${serverId}] Failed to re-read updated resource:`, err));
      }
    } else if (method === 'notifications/progress') {
      // Progress notification
      const progress: MCPProgressNotification = {
        progressToken: (params?.progressToken as string | number) ?? '',
        progress: (params?.progress as number) ?? 0,
        total: params?.total as number | undefined,
        message: params?.message as string | undefined,
      };
      // Update active progress on the server
      setServers(prev => prev.map(s => {
        if (s.id !== serverId) return s;
        const updated = new Map(s.activeProgress);
        updated.set(progress.progressToken, progress);
        return { ...s, activeProgress: updated };
      }));
      options.onProgress?.(serverId, progress);
    } else if (method === 'notifications/message') {
      // Log message from server
      const logMessage: MCPLogMessage = {
        level: (params?.level as MCPLogMessage['level']) ?? 'info',
        logger: params?.logger as string | undefined,
        data: params?.data,
        timestamp: Date.now(),
      };
      setServers(prev => prev.map(s => {
        if (s.id !== serverId) return s;
        return { ...s, logMessages: [...s.logMessages, logMessage] };
      }));
      options.onNotification?.(serverId, method, params);
    } else if (method === 'notifications/cancelled') {
      // Server cancelled one of our pending requests
      const requestId = params?.requestId as string | undefined;
      if (requestId && connection) {
        const pending = connection.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          connection.pendingRequests.delete(requestId);
          pending.reject(new Error(`Request cancelled by server: ${params?.reason || 'no reason'}`));
        }
      }
    } else {
      // Pass through any other notifications
      options.onNotification?.(serverId, method, params);
    }
  }, [sendRequest, updateServer, options]);

  // Handle incoming SSE messages for a server
  const createMessageHandler = useCallback((serverId: string) => {

    return (eventData: string) => {
      try {
        const data = JSON.parse(eventData) as MCPMessage;
        const connection = connectionsRef.current.get(serverId);

        if ('id' in data && data.id !== undefined) {
          // Check if this is a request FROM the server (sampling/elicitation/ping/roots)
          if ('method' in data) {
            const server = servers.find(s => s.id === serverId);
            const serverName = server?.name || 'Unknown Server';

            if (data.method === 'ping') {
              // Respond to server ping
              sendServerResponse(serverId, data.id, {});
            } else if (data.method === 'roots/list') {
              // Respond with empty roots (browser-based client)
              sendServerResponse(serverId, data.id, { roots: [] });
            } else if (data.method === 'sampling/createMessage') {
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
          // Handle list-changed notifications by re-fetching
          handleNotification(serverId, data.method, data.params as Record<string, unknown> | undefined);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };
  }, [options, servers, sendServerResponse, handleNotification]);

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
  const addServer = useCallback(async (options: {
    url: string;
    name?: string;
    credentials?: OAuthCredentials;
    transport?: TransportType;
    customHeaders?: Record<string, string>;
    existingId?: string;
  }): Promise<string> => {
    const { url, name, credentials, transport, customHeaders, existingId } = options;
    const serverId = existingId || uuidv4();

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
      resourceTemplates: [],
      prompts: [],
      credentials,
      transport,
      customHeaders,
      logMessages: [],
      activeProgress: new Map(),
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

  // Schedule reconnection with exponential backoff (max 5 attempts, max 30s delay)
  const scheduleReconnect = useCallback((serverId: string) => {
    const attempts = reconnectAttemptsRef.current.get(serverId) || 0;
    const MAX_ATTEMPTS = 5;
    if (attempts >= MAX_ATTEMPTS) {
      reconnectAttemptsRef.current.delete(serverId);
      updateServer(serverId, { status: 'error', error: 'Reconnection failed after max attempts' });
      options.onError?.(serverId, new Error('Reconnection failed after max attempts'));
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    reconnectAttemptsRef.current.set(serverId, attempts + 1);

    const timer = setTimeout(async () => {
      reconnectTimersRef.current.delete(serverId);
      const server = servers.find(s => s.id === serverId);
      if (!server || server.status === 'connected') return;

      try {
        await connectServerRef.current?.(serverId, server.credentials);
        reconnectAttemptsRef.current.delete(serverId);
      } catch {
        // connectServer already updates error state; scheduleReconnect will be
        // called again from the processStream error handler if needed
      }
    }, delay);

    reconnectTimersRef.current.set(serverId, timer);
  }, [servers, updateServer, options]);

  // Forward ref to connectServer for reconnection
  const connectServerRef = useRef<((serverId: string, credentials?: OAuthCredentials) => Promise<void>) | null>(null);

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
                updateServer(serverId, { status: 'error', error: 'Connection lost, reconnecting...' });
                // Auto-reconnect with exponential backoff
                scheduleReconnect(serverId);
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
          // Roots: Advertise roots support (browser client returns empty list)
          roots: {
            listChanged: true,
          },
          // Logging: Accept log messages from servers
          logging: {},
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
          fetchAllWithPagination(serverId, 'tools/list', 'tools')
            .then(result => ({ type: 'tools', result: { tools: result } }))
            .catch(() => ({ type: 'tools', result: { tools: [] } }))
        );
      }
      if (capabilities.resources) {
        promises.push(
          fetchAllWithPagination(serverId, 'resources/list', 'resources')
            .then(result => ({ type: 'resources', result: { resources: result } }))
            .catch(() => ({ type: 'resources', result: { resources: [] } }))
        );
        // Also fetch resource templates
        promises.push(
          fetchAllWithPagination(serverId, 'resources/templates/list', 'resourceTemplates')
            .then(result => ({ type: 'resourceTemplates', result: { resourceTemplates: result } }))
            .catch(() => ({ type: 'resourceTemplates', result: { resourceTemplates: [] } }))
        );
      }
      if (capabilities.prompts) {
        promises.push(
          fetchAllWithPagination(serverId, 'prompts/list', 'prompts')
            .then(result => ({ type: 'prompts', result: { prompts: result } }))
            .catch(() => ({ type: 'prompts', result: { prompts: [] } }))
        );
      }

      const results = await Promise.all(promises);

      let tools: MCPTool[] = [];
      let resources: MCPResource[] = [];
      let resourceTemplates: MCPResourceTemplate[] = [];
      let prompts: MCPPrompt[] = [];

      for (const { type, result } of results) {
        if (type === 'tools') {
          tools = (result as { tools: MCPTool[] }).tools || [];
        } else if (type === 'resources') {
          const rawResources = (result as { resources: MCPResource[] }).resources || [];
          resources = rawResources.map(normalizeResource);
        } else if (type === 'resourceTemplates') {
          resourceTemplates = (result as { resourceTemplates: MCPResourceTemplate[] }).resourceTemplates || [];
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
        resourceTemplates,
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

  // Keep connectServerRef in sync for reconnection
  connectServerRef.current = connectServer;

  // Disconnect a server
  const disconnectServer = useCallback((serverId: string) => {
    const connection = connectionsRef.current.get(serverId);

    // Cancel any pending reconnect
    const reconnectTimer = reconnectTimersRef.current.get(serverId);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimersRef.current.delete(serverId);
    }
    reconnectAttemptsRef.current.delete(serverId);

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
      resourceTemplates: [],
      prompts: [],
      serverInfo: undefined,
      capabilities: undefined,
      error: undefined,
      logMessages: [],
      activeProgress: new Map(),
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

  // Ping a server and wait for response
  const pingServer = useCallback(async (serverId: string): Promise<void> => {
    await sendRequest(serverId, 'ping', {});
  }, [sendRequest]);

  // Cancel an in-flight request
  const cancelRequest = useCallback((serverId: string, requestId: string, reason?: string) => {
    sendNotification(serverId, 'notifications/cancelled', {
      requestId,
      reason: reason || 'Cancelled by client',
    });

    // Also reject the local pending request if it exists
    const connection = connectionsRef.current.get(serverId);
    if (connection) {
      const pending = connection.pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        connection.pendingRequests.delete(requestId);
        pending.reject(new Error('Request cancelled by client'));
      }
    }
  }, [sendNotification]);

  // Subscribe to resource updates
  const subscribeResource = useCallback(async (serverId: string, uri: string): Promise<void> => {
    await sendRequest(serverId, 'resources/subscribe', { uri });
  }, [sendRequest]);

  // Unsubscribe from resource updates
  const unsubscribeResource = useCallback(async (serverId: string, uri: string): Promise<void> => {
    await sendRequest(serverId, 'resources/unsubscribe', { uri });
  }, [sendRequest]);

  // Get completion/autocomplete suggestions
  const getCompletion = useCallback(async (
    serverId: string,
    ref: { type: 'ref/prompt'; name: string } | { type: 'ref/resource'; uri: string },
    argument: { name: string; value: string }
  ): Promise<MCPCompletionResult> => {
    const result = await sendRequest(serverId, 'completion/complete', {
      ref,
      argument,
    }) as { completion: MCPCompletionResult };
    return result.completion;
  }, [sendRequest]);

  // Set the minimum log level on a server
  const setLogLevel = useCallback(async (serverId: string, level: MCPLogMessage['level']): Promise<void> => {
    await sendRequest(serverId, 'logging/setLevel', { level });
  }, [sendRequest]);

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
    pingServer,
    cancelRequest,
    subscribeResource,
    unsubscribeResource,
    getCompletion,
    setLogLevel,
  };
}
