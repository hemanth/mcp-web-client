'use client';

import { useEffect, useState, useCallback, Suspense, lazy, memo } from 'react';
import { Toaster, toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { useMultiServerMcp } from '@/lib/useMultiServerMcp';
import { useOAuth } from '@/lib/useOAuth';
import { useServerSync } from '@/lib/useServerSync';
import { ServerList, AddServerModal } from '@/components/ServerList';
import { ServerInfo } from '@/components/ServerInfo';
import { SamplingModal } from '@/components/SamplingModal';
import { ElicitationModal } from '@/components/ElicitationModal';
import { useLLMSettings } from '@/components/LLMSettings';
import { UserMenu } from '@/components/UserMenu';
import type { OAuthCredentials, TransportType, SamplingRequest, CreateMessageResult, ElicitationRequest, ElicitResult } from '@/lib/types';
import {
  MessageSquare,
  Wrench,
  FileText,
  BookOpen,
  Zap,
  ChevronLeft,
  ChevronRight,
  Server,
  Loader2,
  Menu,
  X,
  Github,
  LogIn,
} from 'lucide-react';

// Dynamic imports for code splitting - panels are lazy loaded
const ChatPanel = lazy(() => import('@/components/ChatPanel').then(m => ({ default: m.ChatPanel })));
const ToolsPanel = lazy(() => import('@/components/ToolsPanel').then(m => ({ default: m.ToolsPanel })));
const ResourcesPanel = lazy(() => import('@/components/ResourcesPanel').then(m => ({ default: m.ResourcesPanel })));
const PromptsPanel = lazy(() => import('@/components/PromptsPanel').then(m => ({ default: m.PromptsPanel })));

type ActivePanel = 'chat' | 'tools' | 'resources' | 'prompts';

// Loading fallback component
const PanelLoader = memo(function PanelLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
    </div>
  );
});

// Memoized nav item component
const NavItem = memo(function NavItem({
  id,
  label,
  icon: Icon,
  count,
  isActive,
  disabled,
  collapsed,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number | null;
  isActive: boolean;
  disabled: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
        ? 'bg-[var(--accent)] text-white'
        : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {count !== null && count > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs ${isActive
              ? 'bg-white/20 text-white'
              : 'bg-[var(--background-tertiary)] text-[var(--foreground-muted)]'
              }`}>
              {count}
            </span>
          )}
        </>
      )}
    </button>
  );
});

export default function Home() {
  const { data: session, status: authStatus } = useSession();
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingOAuthServer, setPendingOAuthServer] = useState<string | null>(null);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [isAddingServer, setIsAddingServer] = useState(false);

  // Sampling state
  const [pendingSamplingRequest, setPendingSamplingRequest] = useState<SamplingRequest | null>(null);
  const [isSamplingProcessing, setIsSamplingProcessing] = useState(false);
  const [samplingResult, setSamplingResult] = useState<{ success: boolean; content?: string; error?: string } | undefined>();

  // Elicitation state
  const [pendingElicitationRequest, setPendingElicitationRequest] = useState<ElicitationRequest | null>(null);

  // LLM settings for sampling
  const { settings: llmSettings } = useLLMSettings();

  const {
    registerClient,
    startOAuth,
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
    editServer,
    callTool,
    callToolOnServer,
    readResource,
    getPrompt,
    getAllTools,
    respondToSamplingRequest,
    respondToElicitationRequest,
  } = useMultiServerMcp({
    onError: useCallback((serverId: string, error: Error) => {
      toast.error(error.message);
    }, []),
    onSamplingRequest: useCallback((request: SamplingRequest) => {
      console.log('Received sampling request:', request);
      setPendingSamplingRequest(request);
      setSamplingResult(undefined);
    }, []),
    onElicitationRequest: useCallback((request: ElicitationRequest) => {
      console.log('Received elicitation request:', request);
      setPendingElicitationRequest(request);
    }, []),
  });

  // Server sync with D1 database
  const { saveServer, deleteServer: deleteServerFromDb, isAuthenticated } = useServerSync({
    onServersLoaded: useCallback(async (cloudServers: { id: string; name: string; url: string }[]) => {
      // Merge cloud servers with local - cloud takes precedence
      for (const cloudServer of cloudServers) {
        const existingServer = servers.find(s => s.id === cloudServer.id || s.url === cloudServer.url);
        if (!existingServer) {
          // Add server from cloud, preserving the D1 ID
          await addServer(cloudServer.url, cloudServer.name, undefined, undefined, undefined, { existingId: cloudServer.id });
        }
      }
      if (cloudServers.length > 0) {
        toast.success('Servers synced from cloud');
      }
    }, [servers, addServer]),
  });

  // Handle OAuth success from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'oauth-success') {
        const { serverUrl, accessToken, tokenType } = event.data;

        try {
          let serverId = pendingOAuthServer;
          if (!serverId) {
            const existingServer = servers.find(s => s.url === serverUrl);
            if (existingServer) {
              serverId = existingServer.id;
            } else {
              serverId = await addServer(serverUrl);
            }
          }

          if (serverId) {
            await connectServer(serverId, { accessToken, tokenType });
          }
        } catch (error) {
          // Error handled by onError callback
        } finally {
          setPendingOAuthServer(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addServer, connectServer, pendingOAuthServer, servers]);

  const handleAddServer = useCallback(async (url: string, name?: string, credentials?: OAuthCredentials, transport?: TransportType, customHeaders?: Record<string, string>): Promise<string> => {
    const serverId = await addServer(url, name, credentials, transport, customHeaders);

    // Sync to D1 if authenticated
    if (isAuthenticated) {
      await saveServer({ id: serverId, name: name || url, url });
    }

    return serverId;
  }, [addServer, isAuthenticated, saveServer]);

  const handleConnectServer = useCallback(async (serverId: string, credentials?: OAuthCredentials) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    try {
      await connectServer(serverId, credentials || server.credentials);
    } catch {
      // Error handled by onError callback
    }
  }, [servers, connectServer]);

  const handleStartOAuth = useCallback(async (serverUrl: string, serverId?: string): Promise<{ success: boolean; error?: string }> => {
    if (serverId) {
      setPendingOAuthServer(serverId);
    } else {
      const existingServer = servers.find(s => s.url === serverUrl);
      if (existingServer) {
        setPendingOAuthServer(existingServer.id);
      }
    }
    return await startOAuth(serverUrl);
  }, [servers, startOAuth]);

  const handleRegisterClient = useCallback(async (serverUrl: string): Promise<{ success: boolean; clientId?: string; error?: string }> => {
    return await registerClient(serverUrl);
  }, [registerClient]);

  // Handler for direct modal add (used when adding server from empty state)
  const handleDirectAddServer = useCallback(async (url: string, name: string, authType: 'none' | 'bearer' | 'oauth', bearerToken?: string, transport?: TransportType) => {
    setIsAddingServer(true);
    try {
      let credentials: OAuthCredentials | undefined;

      if (authType === 'bearer' && bearerToken) {
        credentials = {
          accessToken: bearerToken,
          tokenType: 'Bearer',
        };
      }

      const serverId = await addServer(url, name || undefined, credentials, transport);

      // Sync to D1 if authenticated
      if (isAuthenticated) {
        await saveServer({ id: serverId, name: name || url, url, authType });
      }

      // Auto-connect with credentials if provided
      if (authType !== 'oauth') {
        await connectServer(serverId, credentials);
      }
      setShowAddServerModal(false);
    } catch (error) {
      console.error('Failed to add server:', error);
    } finally {
      setIsAddingServer(false);
    }
  }, [addServer, connectServer, isAuthenticated, saveServer]);

  // Handler for removing server (with D1 sync)
  const handleRemoveServer = useCallback(async (serverId: string) => {
    removeServer(serverId);
    if (isAuthenticated) {
      await deleteServerFromDb(serverId);
    }
  }, [removeServer, isAuthenticated, deleteServerFromDb]);

  const handleDisconnect = useCallback(() => {
    if (activeServer) {
      disconnectServer(activeServer.id);
    }
  }, [activeServer, disconnectServer]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const isConnected = activeServer?.status === 'connected';
  const connectedServersCount = servers.filter(s => s.status === 'connected').length;

  // Get tools from ALL connected servers for the chat
  const allTools = getAllTools();
  // Current server's resources and prompts (still per-server)
  const currentResources = activeServer?.resources || [];
  const currentPrompts = activeServer?.prompts || [];

  // Handler to call tool on the correct server
  const handleCallToolOnServer = useCallback(async (name: string, args: Record<string, unknown>, serverId?: string) => {
    if (serverId) {
      return await callToolOnServer(serverId, name, args);
    }
    // Fallback to active server if no serverId provided
    return await callTool(name, args);
  }, [callTool, callToolOnServer]);

  // Handler for approving sampling requests
  const handleApproveSampling = useCallback(async () => {
    if (!pendingSamplingRequest) return;

    // Check if LLM is configured
    if (!llmSettings.activeProvider) {
      toast.error('No LLM provider configured. Please configure one in Chat settings.');
      return;
    }

    const providerConfig = llmSettings.providers[llmSettings.activeProvider];
    if (!providerConfig) {
      toast.error('LLM provider configuration not found.');
      return;
    }

    setIsSamplingProcessing(true);
    try {
      // Convert MCP sampling messages to LLM chat format
      const messages = pendingSamplingRequest.params.messages.map(msg => {
        const content = Array.isArray(msg.content)
          ? msg.content.map(c => c.type === 'text' ? c.text : '').join('\n')
          : msg.content.type === 'text' ? msg.content.text : '';
        return {
          role: msg.role,
          content,
        };
      });

      // Call the LLM API with the user's configured provider
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: llmSettings.activeProvider,
          model: providerConfig.model,
          messages,
          systemPrompt: pendingSamplingRequest.params.systemPrompt,
          apiKey: providerConfig.apiKey,
          baseUrl: providerConfig.baseUrl,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'LLM request failed');
      }

      const data = await response.json();
      const resultContent = data.message?.content || '';

      // Send the result back to the MCP server
      const result: CreateMessageResult = {
        role: 'assistant',
        content: { type: 'text', text: resultContent },
        model: providerConfig.model,
        stopReason: 'endTurn',
      };

      await respondToSamplingRequest(
        pendingSamplingRequest.serverId,
        pendingSamplingRequest.id,
        result
      );

      setSamplingResult({ success: true, content: resultContent });
      toast.success('Sampling request completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSamplingResult({ success: false, error: errorMessage });

      // Send error response to server
      await respondToSamplingRequest(
        pendingSamplingRequest.serverId,
        pendingSamplingRequest.id,
        { error: { code: -32000, message: errorMessage } }
      );

      toast.error(`Sampling failed: ${errorMessage}`);
    } finally {
      setIsSamplingProcessing(false);
    }
  }, [pendingSamplingRequest, respondToSamplingRequest, llmSettings]);

  // Handler for denying sampling requests
  const handleDenySampling = useCallback(async () => {
    if (!pendingSamplingRequest) return;

    await respondToSamplingRequest(
      pendingSamplingRequest.serverId,
      pendingSamplingRequest.id,
      { error: { code: -32001, message: 'User denied sampling request' } }
    );

    setPendingSamplingRequest(null);
    setSamplingResult(undefined);
    toast.info('Sampling request denied');
  }, [pendingSamplingRequest, respondToSamplingRequest]);

  // Handler for submitting elicitation results
  const handleElicitationSubmit = useCallback(async (result: ElicitResult) => {
    if (!pendingElicitationRequest) return;

    await respondToElicitationRequest(
      pendingElicitationRequest.serverId,
      pendingElicitationRequest.id,
      result
    );

    setPendingElicitationRequest(null);

    if (result.action === 'accept') {
      toast.success('Response submitted successfully');
    } else if (result.action === 'decline') {
      toast.info('Request declined');
    } else {
      toast.info('Request cancelled');
    }
  }, [pendingElicitationRequest, respondToElicitationRequest]);

  // Handler for declining elicitation
  const handleElicitationDecline = useCallback(() => {
    setPendingElicitationRequest(null);
  }, []);

  // Handler for cancelling elicitation
  const handleElicitationCancel = useCallback(() => {
    setPendingElicitationRequest(null);
  }, []);

  // Tools for the active server (for the Tools panel)
  const currentTools = activeServer?.tools || [];

  const navItems = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, count: null },
    { id: 'tools' as const, label: 'Tools', icon: Wrench, count: currentTools.length },
    { id: 'resources' as const, label: 'Resources', icon: FileText, count: currentResources.length },
    { id: 'prompts' as const, label: 'Prompts', icon: BookOpen, count: currentPrompts.length },
  ];

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
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

      {/* Mobile Header */}
      <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--background-secondary)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">MCPHost</span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href="https://github.com/hemanth/mcp-web-client"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-[var(--background-tertiary)] rounded-lg text-[var(--foreground-muted)]"
            title="View on GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 hover:bg-[var(--background-tertiary)] rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer / Desktop Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${sidebarCollapsed ? 'md:w-16' : 'w-72'}
        bg-[var(--background-secondary)] border-r border-[var(--border)]
        flex flex-col transition-transform duration-200 ease-out
        md:flex-shrink-0
      `}>
        {/* Logo - Desktop only (mobile has header) */}
        <div className="hidden md:flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg gradient-text">MCPHost</h1>
                <p className="text-xs text-[var(--foreground-muted)]">Multi-Server</p>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)] transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* Mobile Drawer Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border)]">
          <span className="font-semibold">Servers</span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 hover:bg-[var(--background-tertiary)] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server List */}
        <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
          <ServerList
            servers={servers}
            activeServerId={activeServerId}
            onSelectServer={(id) => {
              setActiveServerId(id);
              setMobileMenuOpen(false);
            }}
            onAddServer={handleAddServer}
            onConnectServer={handleConnectServer}
            onDisconnectServer={disconnectServer}
            onRemoveServer={handleRemoveServer}
            onEditServer={editServer}
            onStartOAuth={handleStartOAuth}
            onRegisterClient={handleRegisterClient}
            collapsed={sidebarCollapsed}
          />
        </div>

        {/* Navigation - Desktop only (mobile uses bottom nav) */}
        <nav className="hidden md:block flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              count={item.count}
              isActive={activePanel === item.id}
              disabled={!isConnected && item.id !== 'chat'}
              collapsed={sidebarCollapsed}
              onClick={() => setActivePanel(item.id)}
            />
          ))}
        </nav>

        {/* Server Info in Mobile Drawer */}
        {isConnected && activeServer && (
          <div className="md:hidden flex-1 p-3 overflow-y-auto border-t border-[var(--border)]">
            <ServerInfo
              serverInfo={activeServer.serverInfo}
              capabilities={activeServer.capabilities}
              toolsCount={currentTools.length}
              resourcesCount={currentResources.length}
              promptsCount={currentPrompts.length}
            />
            <button
              onClick={() => {
                handleDisconnect();
                setMobileMenuOpen(false);
              }}
              className="w-full mt-4 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium"
            >
              Disconnect
            </button>
          </div>
        )}

      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--background-secondary)]">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold capitalize">{activePanel}</h2>
            {/* Show active server for non-chat panels */}
            {activePanel !== 'chat' && isConnected && activeServer && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--background-tertiary)] text-xs text-[var(--foreground-muted)]">
                <Server className="w-3 h-3" />
                {activeServer.serverInfo?.name || activeServer.name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/hemanth/mcp-web-client"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)] transition-colors"
              title="View on GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            {session ? (
              <UserMenu />
            ) : authStatus !== 'loading' && (
              <a
                href="/login"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </a>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Main Panel */}
          <div className={`flex-1 ${isConnected || servers.length > 0 ? 'p-4 md:p-6' : 'p-4 md:p-6 flex items-center justify-center'} overflow-y-auto contain-layout`}>
            {servers.length === 0 ? (
              <div className="text-center max-w-md mx-auto">
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-4 md:mb-6">
                  <Server className="w-8 h-8 md:w-10 md:h-10 text-[var(--foreground-muted)]" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3">Add Your First Server</h3>
                <p className="text-sm md:text-base text-[var(--foreground-muted)] mb-4 md:mb-6">
                  Connect to MCP servers to start interacting with their tools, resources, and prompts.
                </p>
                {/* Mobile: Direct add button */}
                <button
                  onClick={() => setShowAddServerModal(true)}
                  className="md:hidden w-full max-w-xs mx-auto px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Server className="w-4 h-4" />
                  Add Server
                </button>
                {/* Desktop: Hint text */}
                <p className="hidden md:block text-xs md:text-sm text-[var(--foreground-muted)]">
                  Click the <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--background-tertiary)] rounded"><span className="text-lg">+</span></span> button in the sidebar to add a server.
                </p>
              </div>
            ) : !isConnected ? (
              <div className="text-center max-w-md mx-auto">
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-4 md:mb-6">
                  <Server className="w-8 h-8 md:w-10 md:h-10 text-[var(--foreground-muted)]" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3">Select a Server</h3>
                <p className="text-sm md:text-base text-[var(--foreground-muted)]">
                  <span className="md:hidden">Tap the menu icon to select a server.</span>
                  <span className="hidden md:inline">Click on a server in the sidebar to connect or select it as active.</span>
                </p>
              </div>
            ) : (
              <div className="h-full">
                <Suspense fallback={<PanelLoader />}>
                  {activePanel === 'chat' && (
                    <ChatPanel
                      tools={allTools}
                      onCallTool={handleCallToolOnServer}
                      disabled={connectedServersCount === 0}
                      connectedServers={servers
                        .filter(s => s.status === 'connected')
                        .map(s => ({ id: s.id, name: s.serverInfo?.name || s.name }))}
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
                </Suspense>
              </div>
            )}
          </div>

        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden flex-shrink-0 border-t border-[var(--border)] bg-[var(--background-secondary)]">
          <div className="flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePanel === item.id;
              const disabled = !isConnected && item.id !== 'chat';
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  disabled={disabled}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs ${isActive
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--foreground-muted)]'
                    } ${disabled ? 'opacity-50' : ''}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {item.count !== null && item.count > 0 && (
                    <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${isActive ? 'bg-[var(--accent)] text-white' : 'bg-[var(--background-tertiary)]'
                      }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Error state overlay */}
      {activeServer?.status === 'error' && activeServer.error && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-lg z-40">
          <h3 className="font-medium text-red-400 mb-1">Connection Error</h3>
          <p className="text-sm text-red-300/80">{activeServer.error}</p>
        </div>
      )}

      {/* Direct Add Server Modal (for mobile empty state) */}
      {showAddServerModal && (
        <AddServerModal
          onAdd={handleDirectAddServer}
          onAddServer={(url, name, transport, customHeaders) => handleAddServer(url, name, undefined, transport, customHeaders)}
          onStartOAuth={handleStartOAuth}
          onRegisterClient={handleRegisterClient}
          onClose={() => setShowAddServerModal(false)}
          isLoading={isAddingServer}
        />
      )}

      {/* Sampling Request Modal */}
      {pendingSamplingRequest && (
        <SamplingModal
          request={pendingSamplingRequest}
          onApprove={handleApproveSampling}
          onDeny={handleDenySampling}
          isProcessing={isSamplingProcessing}
          result={samplingResult}
        />
      )}

      {/* Elicitation Request Modal */}
      {pendingElicitationRequest && (
        <ElicitationModal
          request={pendingElicitationRequest}
          onSubmit={handleElicitationSubmit}
          onDecline={handleElicitationDecline}
          onCancel={handleElicitationCancel}
        />
      )}
    </div>
  );
}
