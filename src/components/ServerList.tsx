'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Server,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Check,
  Trash2,
  Power,
  PowerOff,
  Key,
  Shield,
  Globe,
} from 'lucide-react';
import type { ServerInstance, OAuthCredentials } from '@/lib/types';

type AuthType = 'none' | 'bearer' | 'oauth';

interface ServerListProps {
  servers: ServerInstance[];
  activeServerId: string | null;
  onSelectServer: (serverId: string) => void;
  onAddServer: (url: string, name?: string, credentials?: OAuthCredentials) => Promise<string>;
  onConnectServer: (serverId: string, credentials?: OAuthCredentials) => Promise<void>;
  onDisconnectServer: (serverId: string) => void;
  onRemoveServer: (serverId: string) => void;
  onStartOAuth: (serverUrl: string, serverId?: string) => Promise<{ success: boolean; error?: string }>;
  onRegisterClient: (serverUrl: string) => Promise<{ success: boolean; clientId?: string; error?: string }>;
  collapsed?: boolean;
}

interface AddServerModalProps {
  onAdd: (url: string, name: string, authType: AuthType, bearerToken?: string) => void;
  onAddServer: (url: string, name?: string) => Promise<string>;
  onStartOAuth: (serverUrl: string, serverId?: string) => Promise<{ success: boolean; error?: string }>;
  onRegisterClient: (serverUrl: string) => Promise<{ success: boolean; clientId?: string; error?: string }>;
  onClose: () => void;
  isLoading: boolean;
}

export function AddServerModal({ onAdd, onAddServer, onStartOAuth, onRegisterClient, onClose, isLoading }: AddServerModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [authType, setAuthType] = useState<AuthType>('none');
  const [bearerToken, setBearerToken] = useState('');
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'registering' | 'authorizing' | 'success' | 'error'>('idle');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (authType === 'oauth') {
      setOauthStatus('registering');
      setOauthError(null);

      try {
        const regResult = await onRegisterClient(url.trim());
        if (!regResult.success) {
          setOauthStatus('error');
          setOauthError(regResult.error || 'Failed to register client');
          return;
        }

        const serverId = await onAddServer(url.trim(), name.trim() || undefined);
        setOauthStatus('authorizing');

        const authResult = await onStartOAuth(url.trim(), serverId);
        if (!authResult.success) {
          setOauthStatus('error');
          setOauthError(authResult.error || 'Failed to start OAuth');
          return;
        }

        onClose();
      } catch (error) {
        setOauthStatus('error');
        setOauthError(error instanceof Error ? error.message : 'OAuth failed');
      }
    } else {
      onAdd(url.trim(), name.trim(), authType, authType === 'bearer' ? bearerToken : undefined);
      onClose();
    }
  };

  const authOptions = [
    { value: 'none' as AuthType, label: 'None', icon: Globe },
    { value: 'bearer' as AuthType, label: 'Token', icon: Key },
    { value: 'oauth' as AuthType, label: 'OAuth', icon: Shield },
  ];

  const isProcessing = isLoading || oauthStatus === 'registering' || oauthStatus === 'authorizing';

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !isProcessing && onClose()}
    >
      <div className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-base font-semibold">Add Server</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--background-tertiary)] rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Server URL */}
          <div>
            <label className="block text-sm font-medium mb-1">Server URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com/sse"
              className="w-full px-3 py-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--foreground-muted)]"
              autoFocus
              required
              disabled={isProcessing}
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Name <span className="text-[var(--foreground-muted)] font-normal text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Server"
              className="w-full px-3 py-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--foreground-muted)]"
              disabled={isProcessing}
            />
          </div>

          {/* Auth Type - Simple horizontal pills */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Auth</label>
            <div className="flex gap-1.5 p-1 bg-[var(--background-tertiary)] rounded-lg">
              {authOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAuthType(option.value)}
                  disabled={isProcessing}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                    authType === option.value
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                  } disabled:opacity-50`}
                >
                  <option.icon className="w-3.5 h-3.5" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bearer Token Input */}
          {authType === 'bearer' && (
            <div>
              <label className="block text-sm font-medium mb-1">Token</label>
              <input
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Enter access token"
                className="w-full px-3 py-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--foreground-muted)] font-mono"
                required
                disabled={isLoading}
              />
            </div>
          )}

          {/* OAuth Status */}
          {authType === 'oauth' && oauthStatus !== 'idle' && (
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              oauthStatus === 'error'
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-[var(--accent)]/10 border-[var(--accent)]/20'
            }`}>
              {(oauthStatus === 'registering' || oauthStatus === 'authorizing') && (
                <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin flex-shrink-0" />
              )}
              {oauthStatus === 'error' && (
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <p className={`text-xs ${oauthStatus === 'error' ? 'text-red-400' : 'text-[var(--accent)]'}`}>
                {oauthStatus === 'registering' && 'Registering...'}
                {oauthStatus === 'authorizing' && 'Opening auth...'}
                {oauthStatus === 'error' && (oauthError || 'Failed')}
              </p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-2 p-4 pt-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-3 py-2 bg-[var(--background-tertiary)] hover:bg-[var(--border)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isProcessing || !url.trim() || (authType === 'bearer' && !bearerToken.trim())}
            className="flex-1 px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {authType === 'oauth' ? 'Auth' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}

interface ServerItemProps {
  server: ServerInstance;
  isActive: boolean;
  onSelect: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
  collapsed?: boolean;
}

function ServerItem({
  server,
  isActive,
  onSelect,
  onConnect,
  onDisconnect,
  onRemove,
  collapsed,
}: ServerItemProps) {
  const [showActions, setShowActions] = useState(false);

  const getStatusColor = () => {
    switch (server.status) {
      case 'connected':
        return 'bg-[var(--success)]';
      case 'connecting':
      case 'authenticating':
        return 'bg-[var(--warning)] animate-pulse';
      case 'error':
        return 'bg-[var(--error)]';
      default:
        return 'bg-[var(--foreground-muted)]';
    }
  };

  const getStatusBg = () => {
    switch (server.status) {
      case 'connected':
        return 'bg-green-500/10 border-green-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      default:
        return 'bg-[var(--background-tertiary)] border-transparent';
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={onSelect}
        className={`w-full p-2 rounded-lg flex items-center justify-center transition-all ${
          isActive ? 'bg-[var(--accent)]' : 'hover:bg-[var(--background-tertiary)]'
        }`}
        title={server.name}
      >
        <div className="relative">
          <Server className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
          <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--background-secondary)] ${getStatusColor()}`} />
        </div>
      </button>
    );
  }

  return (
    <div
      className={`group relative rounded-xl border transition-all ${
        isActive
          ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30'
          : getStatusBg()
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="p-3 flex items-center gap-3">
        <button
          onClick={onSelect}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="relative flex-shrink-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isActive ? 'bg-[var(--accent)]' : 'bg-[var(--background-tertiary)]'
            }`}>
              <Server className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--background-secondary)] ${getStatusColor()}`} />
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${isActive ? 'text-[var(--accent)]' : ''}`}>
              {server.serverInfo?.name || server.name}
            </p>
            <p className="text-xs text-[var(--foreground-muted)] truncate">
              {server.status === 'connected'
                ? `${server.tools.length} tools`
                : server.status}
            </p>
          </div>

          {isActive && (
            <Check className="w-4 h-4 text-[var(--accent)] flex-shrink-0 hidden md:block" />
          )}
        </button>

        {/* Action buttons - always visible on mobile, hover on desktop */}
        <div className={`flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${showActions ? 'md:opacity-100' : ''}`}>
          {server.status === 'connected' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect();
              }}
              className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
              title="Disconnect"
            >
              <PowerOff className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConnect();
              }}
              className="p-1.5 hover:bg-green-500/20 rounded text-green-400"
              title="Connect"
            >
              <Power className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 hover:bg-red-500/20 rounded text-[var(--foreground-muted)] hover:text-red-400"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {server.status === 'error' && server.error && (
        <div className="px-3 pb-3 -mt-1">
          <div className="flex items-start gap-2 text-xs text-red-400">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{server.error}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ServerList({
  servers,
  activeServerId,
  onSelectServer,
  onAddServer,
  onConnectServer,
  onDisconnectServer,
  onRemoveServer,
  onStartOAuth,
  onRegisterClient,
  collapsed,
}: ServerListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddServer = async (url: string, name: string, authType: AuthType, bearerToken?: string) => {
    setIsAdding(true);
    try {
      let credentials: OAuthCredentials | undefined;

      if (authType === 'bearer' && bearerToken) {
        credentials = {
          accessToken: bearerToken,
          tokenType: 'Bearer',
        };
      }

      const serverId = await onAddServer(url, name || undefined, credentials);

      // Auto-connect with credentials if provided
      if (authType !== 'oauth') {
        await onConnectServer(serverId, credentials);
      }
      // For OAuth, the connection will happen after the callback
    } catch (error) {
      console.error('Failed to add server:', error);
    } finally {
      setIsAdding(false);
    }
  };

  if (collapsed) {
    return (
      <div className="space-y-2">
        {servers.map((server) => (
          <ServerItem
            key={server.id}
            server={server}
            isActive={server.id === activeServerId}
            onSelect={() => onSelectServer(server.id)}
            onConnect={() => onConnectServer(server.id)}
            onDisconnect={() => onDisconnectServer(server.id)}
            onRemove={() => onRemoveServer(server.id)}
            collapsed
          />
        ))}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full p-2 rounded-lg flex items-center justify-center hover:bg-[var(--background-tertiary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          title="Add Server"
        >
          <Plus className="w-5 h-5" />
        </button>

        {showAddModal && (
          <AddServerModal
            onAdd={handleAddServer}
            onAddServer={onAddServer}
            onStartOAuth={onStartOAuth}
            onRegisterClient={onRegisterClient}
            onClose={() => setShowAddModal(false)}
            isLoading={isAdding}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {servers.length === 0 ? (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full p-4 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors flex flex-col items-center gap-2"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm">Add your first server</span>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">
              Servers
            </h4>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={isAdding}
              className="p-1 hover:bg-[var(--background-tertiary)] rounded text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
              title="Add Server"
            >
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="space-y-2">
            {servers.map((server) => (
              <ServerItem
                key={server.id}
                server={server}
                isActive={server.id === activeServerId}
                onSelect={() => onSelectServer(server.id)}
                onConnect={() => onConnectServer(server.id)}
                onDisconnect={() => onDisconnectServer(server.id)}
                onRemove={() => onRemoveServer(server.id)}
              />
            ))}
          </div>
        </>
      )}

      {showAddModal && (
        <AddServerModal
          onAdd={handleAddServer}
          onAddServer={onAddServer}
          onStartOAuth={onStartOAuth}
          onRegisterClient={onRegisterClient}
          onClose={() => setShowAddModal(false)}
          isLoading={isAdding}
        />
      )}
    </div>
  );
}
