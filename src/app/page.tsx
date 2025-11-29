'use client';

import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { useMultiServerMcp } from '@/lib/useMultiServerMcp';
import { useOAuth } from '@/lib/useOAuth';
import { ServerList } from '@/components/ServerList';
import { ServerInfo } from '@/components/ServerInfo';
import { ToolsPanel } from '@/components/ToolsPanel';
import { ResourcesPanel } from '@/components/ResourcesPanel';
import { PromptsPanel } from '@/components/PromptsPanel';
import { ChatPanel } from '@/components/ChatPanel';
import type { OAuthCredentials } from '@/lib/types';
import {
  MessageSquare,
  Wrench,
  FileText,
  BookOpen,
  Zap,
  ChevronLeft,
  ChevronRight,
  Server,
  Layers,
} from 'lucide-react';

type ActivePanel = 'chat' | 'tools' | 'resources' | 'prompts';

export default function Home() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingOAuthServer, setPendingOAuthServer] = useState<string | null>(null);

  const {
    isAuthenticating,
    getCredentials,
    registerClient,
    startOAuth,
    setBearerToken,
  } = useOAuth();

  const {
    servers,
    activeServerId,
    activeServer,
    setActiveServerId,
    addServer,
    connectServer,
    disconnectServer,
    removeServer,
    callTool,
    readResource,
    getPrompt,
    getAllTools,
    getAllResources,
    getAllPrompts,
  } = useMultiServerMcp({
    onNotification: (serverId, method, params) => {
      const server = servers.find(s => s.id === serverId);
      console.log(`[${server?.name}] Notification:`, method, params);
      toast.info(`${server?.name}: ${method}`);
    },
    onServerChange: (serverId, status) => {
      const server = servers.find(s => s.id === serverId);
      if (status === 'connected') {
        toast.success(`Connected to ${server?.name || 'server'}`);
      } else if (status === 'error') {
        toast.error(`Error connecting to ${server?.name || 'server'}`);
      }
    },
    onError: (serverId, error) => {
      const server = servers.find(s => s.id === serverId);
      toast.error(`${server?.name || 'Server'}: ${error.message}`);
    },
  });

  // Handle OAuth success from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'oauth-success') {
        const { serverUrl, accessToken, tokenType } = event.data;
        console.log('OAuth success received for:', serverUrl);

        try {
          // Find the pending server or add a new one
          let serverId = pendingOAuthServer;
          if (!serverId) {
            // Look for existing server with this URL
            const existingServer = servers.find(s => s.url === serverUrl);
            if (existingServer) {
              serverId = existingServer.id;
            } else {
              // Add new server
              serverId = await addServer(serverUrl);
            }
          }

          if (serverId) {
            await connectServer(serverId, { accessToken, tokenType });
          }
        } catch (error) {
          console.error('Failed to connect after OAuth:', error);
        } finally {
          setPendingOAuthServer(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addServer, connectServer, pendingOAuthServer, servers]);

  const handleAddServer = async (url: string, name?: string, credentials?: OAuthCredentials): Promise<string> => {
    return await addServer(url, name, credentials);
  };

  const handleConnectServer = async (serverId: string, credentials?: OAuthCredentials) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    try {
      // Use provided credentials or stored credentials
      await connectServer(serverId, credentials || server.credentials);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleStartOAuth = async (serverUrl: string, serverId?: string): Promise<{ success: boolean; error?: string }> => {
    // Store the serverId to connect after OAuth callback
    // If serverId is provided (from newly added server), use it directly
    // Otherwise try to find existing server by URL
    if (serverId) {
      setPendingOAuthServer(serverId);
    } else {
      const existingServer = servers.find(s => s.url === serverUrl);
      if (existingServer) {
        setPendingOAuthServer(existingServer.id);
      }
    }
    return await startOAuth(serverUrl);
  };

  const handleRegisterClient = async (serverUrl: string): Promise<{ success: boolean; clientId?: string; error?: string }> => {
    return await registerClient(serverUrl);
  };

  const isConnected = activeServer?.status === 'connected';
  const connectedServersCount = servers.filter(s => s.status === 'connected').length;

  // Get current server's data or aggregated data
  const currentTools = activeServer?.tools || [];
  const currentResources = activeServer?.resources || [];
  const currentPrompts = activeServer?.prompts || [];

  const navItems = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, count: null },
    { id: 'tools' as const, label: 'Tools', icon: Wrench, count: currentTools.length },
    { id: 'resources' as const, label: 'Resources', icon: FileText, count: currentResources.length },
    { id: 'prompts' as const, label: 'Prompts', icon: BookOpen, count: currentPrompts.length },
  ];

  return (
    <div className="h-screen flex overflow-hidden">
      <Toaster
        position="top-right"
        richColors
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--background-secondary)',
            border: '1px solid var(--border)',
          },
        }}
      />

      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-72'} flex-shrink-0 bg-[var(--background-secondary)] border-r border-[var(--border)] flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg gradient-text">MCP Client</h1>
                <p className="text-xs text-[var(--foreground-muted)]">Multi-Server</p>
              </div>
            )}
          </div>
        </div>

        {/* Server List */}
        <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
          {!sidebarCollapsed && connectedServersCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <Layers className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">
                {connectedServersCount} server{connectedServersCount !== 1 ? 's' : ''} connected
              </span>
            </div>
          )}
          <ServerList
            servers={servers}
            activeServerId={activeServerId}
            onSelectServer={setActiveServerId}
            onAddServer={handleAddServer}
            onConnectServer={handleConnectServer}
            onDisconnectServer={disconnectServer}
            onRemoveServer={removeServer}
            onStartOAuth={handleStartOAuth}
            onRegisterClient={handleRegisterClient}
            collapsed={sidebarCollapsed}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              disabled={!isConnected && item.id !== 'chat'}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activePanel === item.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)]'
              } ${!isConnected && item.id !== 'chat' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.count !== null && item.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      activePanel === item.id
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--background-tertiary)] text-[var(--foreground-muted)]'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Collapse button */}
        <div className="p-3 border-t border-[var(--border)]">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)]"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--background-secondary)]">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold capitalize">{activePanel}</h2>
            {isConnected && activeServer && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--background-tertiary)] text-xs text-[var(--foreground-muted)]">
                <Server className="w-3 h-3" />
                {activeServer.serverInfo?.name || activeServer.name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {connectedServersCount > 1 && (
              <span className="text-xs text-[var(--foreground-muted)] bg-[var(--background-tertiary)] px-2 py-1 rounded">
                {connectedServersCount} servers
              </span>
            )}
            <span className="text-xs text-[var(--foreground-muted)]">
              Protocol: 2024-11-05
            </span>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Panel */}
          <div className={`flex-1 ${isConnected || servers.length > 0 ? 'p-6' : 'p-6 flex items-center justify-center'} overflow-y-auto`}>
            {servers.length === 0 ? (
              <div className="text-center max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-6">
                  <Server className="w-10 h-10 text-[var(--foreground-muted)]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Add Your First Server</h3>
                <p className="text-[var(--foreground-muted)] mb-6">
                  Connect to MCP servers to start interacting with their tools, resources, and prompts.
                </p>
                <p className="text-sm text-[var(--foreground-muted)]">
                  Click the <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--background-tertiary)] rounded"><span className="text-lg">+</span></span> button in the sidebar to add a server.
                </p>
              </div>
            ) : !isConnected ? (
              <div className="text-center max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-6">
                  <Server className="w-10 h-10 text-[var(--foreground-muted)]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Select a Server</h3>
                <p className="text-[var(--foreground-muted)]">
                  Click on a server in the sidebar to connect or select it as active.
                </p>
              </div>
            ) : (
              <div className="h-full">
                {activePanel === 'chat' && (
                  <ChatPanel
                    tools={currentTools}
                    onCallTool={callTool}
                    disabled={!isConnected}
                    serverName={activeServer?.serverInfo?.name || activeServer?.name}
                  />
                )}

                {activePanel === 'tools' && (
                  <ToolsPanel
                    tools={currentTools}
                    onCallTool={callTool}
                    disabled={!isConnected}
                  />
                )}

                {activePanel === 'resources' && (
                  <ResourcesPanel
                    resources={currentResources}
                    onReadResource={readResource}
                    disabled={!isConnected}
                  />
                )}

                {activePanel === 'prompts' && (
                  <PromptsPanel
                    prompts={currentPrompts}
                    onGetPrompt={getPrompt}
                    disabled={!isConnected}
                  />
                )}
              </div>
            )}
          </div>

          {/* Server Info Sidebar - When connected */}
          {isConnected && activeServer && (
            <div className="w-72 p-4 border-l border-[var(--border)] overflow-y-auto bg-[var(--background-secondary)]">
              <ServerInfo
                serverInfo={activeServer.serverInfo}
                capabilities={activeServer.capabilities}
                toolsCount={currentTools.length}
                resourcesCount={currentResources.length}
                promptsCount={currentPrompts.length}
              />

              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <button
                  onClick={() => disconnectServer(activeServer.id)}
                  className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error state overlay */}
      {activeServer?.status === 'error' && activeServer.error && (
        <div className="fixed bottom-6 right-6 max-w-md p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-lg">
          <h3 className="font-medium text-red-400 mb-1">Connection Error</h3>
          <p className="text-sm text-red-300/80">{activeServer.error}</p>
        </div>
      )}
    </div>
  );
}
