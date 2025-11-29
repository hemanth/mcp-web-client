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
} from './types';

const MCP_PROTOCOL_VERSION = '2024-11-05';
const STORAGE_KEY = 'mcp-servers';

interface UseMultiServerMcpOptions {
  onNotification?: (serverId: string, method: string, params: unknown) => void;
  onServerChange?: (serverId: string, status: ConnectionStatus) => void;
  onError?: (serverId: string, error: Error) => void;
}

interface ServerConnection {
  serverUrl: string;
  credentials: OAuthCredentials | null;
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
}

// Load servers from localStorage
function loadStoredServers(): ServerInstance[] {
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

  // Load servers from localStorage on mount
  useEffect(() => {
    const stored = loadStoredServers();
    if (stored.length > 0) {
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

    console.log(`[${serverId}] Sending MCP notification:`, method);

    fetch('/api/mcp/message', {
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
  }, []);

  // Handle incoming SSE messages for a server
  const createMessageHandler = useCallback((serverId: string) => {
    return (eventData: string) => {
      try {
        const data = JSON.parse(eventData) as MCPMessage;
        const connection = connectionsRef.current.get(serverId);

        if ('id' in data && data.id !== undefined) {
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
  }, [options]);

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
    credentials?: OAuthCredentials
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

    // Create connection state
    const connection: ServerConnection = {
      serverUrl: server.url,
      credentials: credentials || server.credentials || null,
      sessionId: null,
      messageEndpoint: null,
      pendingRequests: new Map(),
      abortController: new AbortController(),
    };

    connectionsRef.current.set(serverId, connection);
    updateServer(serverId, { status: 'connecting', credentials });
    options.onServerChange?.(serverId, 'connecting');

    try {
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

      const initResult = await sendRequest(serverId, 'initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
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
          resources = (result as { resources: MCPResource[] }).resources || [];
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
    callTool,
    callToolOnServer,
    readResource,
    getPrompt,
    getAllTools,
    getAllResources,
    getAllPrompts,
  };
}
