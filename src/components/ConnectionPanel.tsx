'use client';

import { useState } from 'react';
import { Loader2, Plug, Key, Globe, Shield, ChevronDown } from 'lucide-react';
import type { ConnectionStatus, OAuthCredentials } from '@/lib/types';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  serverUrl?: string;
  onConnect: (serverUrl: string, credentials?: OAuthCredentials) => Promise<void>;
  onDisconnect: () => void;
  onRegister: (serverUrl: string) => Promise<{ success: boolean; clientId?: string; clientSecret?: string; error?: string }>;
  onStartOAuth: (serverUrl: string, clientId?: string, clientSecret?: string) => Promise<{ success: boolean; error?: string }>;
  onSetBearerToken: (serverUrl: string, token: string) => void;
  getCredentials: (serverUrl: string) => OAuthCredentials | undefined;
  isAuthenticating: boolean;
}

type AuthMode = 'none' | 'oauth' | 'bearer' | 'oauth-manual';

export function ConnectionPanel({
  status,
  serverUrl: connectedUrl,
  onConnect,
  onDisconnect,
  onRegister,
  onStartOAuth,
  onSetBearerToken,
  getCredentials,
  isAuthenticating,
}: ConnectionPanelProps) {
  const [serverUrl, setServerUrl] = useState('https://mcp.paypal.com');
  const [authMode, setAuthMode] = useState<AuthMode>('bearer');
  const [bearerToken, setBearerToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleConnect = async () => {
    setError(null);
    setIsConnecting(true);

    try {
      const normalizedUrl = serverUrl.replace(/\/$/, '');

      if (authMode === 'none') {
        await onConnect(normalizedUrl);
      } else if (authMode === 'bearer') {
        if (!bearerToken.trim()) {
          throw new Error('Bearer token is required');
        }
        onSetBearerToken(normalizedUrl, bearerToken.trim());
        await onConnect(normalizedUrl, {
          accessToken: bearerToken.trim(),
          tokenType: 'Bearer',
        });
      } else if (authMode === 'oauth') {
        const existingCreds = getCredentials(normalizedUrl);
        if (existingCreds) {
          try {
            await onConnect(normalizedUrl, existingCreds);
          } catch (connError) {
            console.log('Connection with cached credentials failed, re-authenticating...');
            const regResult = await onRegister(normalizedUrl);
            if (!regResult.success) {
              throw new Error(regResult.error || 'Client registration failed');
            }
            const oauthResult = await onStartOAuth(normalizedUrl, regResult.clientId, regResult.clientSecret);
            if (!oauthResult.success) {
              throw new Error(oauthResult.error || 'OAuth initialization failed');
            }
          }
        } else {
          const regResult = await onRegister(normalizedUrl);
          if (!regResult.success) {
            throw new Error(regResult.error || 'Client registration failed');
          }
          const oauthResult = await onStartOAuth(normalizedUrl, regResult.clientId, regResult.clientSecret);
          if (!oauthResult.success) {
            throw new Error(oauthResult.error || 'OAuth initialization failed');
          }
        }
      } else if (authMode === 'oauth-manual') {
        if (!clientId.trim()) {
          throw new Error('Client ID is required');
        }
        const existingCreds = getCredentials(normalizedUrl);
        if (existingCreds) {
          await onConnect(normalizedUrl, existingCreds);
        } else {
          const oauthResult = await onStartOAuth(normalizedUrl, clientId.trim(), clientSecret.trim() || undefined);
          if (!oauthResult.success) {
            throw new Error(oauthResult.error || 'OAuth initialization failed');
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const isLoading = isConnecting || isAuthenticating || status === 'connecting' || status === 'authenticating';
  const isConnected = status === 'connected';

  const authModes = [
    { value: 'bearer' as const, label: 'Bearer Token', icon: Key, description: 'Use a pre-existing access token' },
    { value: 'oauth' as const, label: 'OAuth 2.0', icon: Shield, description: 'Authenticate via OAuth flow' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-[var(--accent)]" />
          Connect to Server
        </h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Enter your MCP server details to get started
        </p>
      </div>

      {/* Server URL */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Server URL
        </label>
        <input
          type="url"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://mcp.example.com"
          disabled={isConnected || isLoading}
          className="w-full px-4 py-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-50 placeholder:text-[var(--foreground-muted)]"
        />
      </div>

      {/* Auth Mode */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Authentication
        </label>
        <div className="grid grid-cols-2 gap-3">
          {authModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setAuthMode(mode.value)}
              disabled={isConnected || isLoading}
              className={`p-4 rounded-xl border text-left transition-all ${
                authMode === mode.value
                  ? 'bg-[var(--accent)]/10 border-[var(--accent)] ring-1 ring-[var(--accent)]'
                  : 'bg-[var(--background-tertiary)] border-[var(--border)] hover:border-[var(--border-hover)]'
              } disabled:opacity-50`}
            >
              <mode.icon className={`w-5 h-5 mb-2 ${authMode === mode.value ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`} />
              <div className={`text-sm font-medium ${authMode === mode.value ? 'text-[var(--accent)]' : ''}`}>
                {mode.label}
              </div>
              <div className="text-xs text-[var(--foreground-muted)] mt-1">
                {mode.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bearer Token Input */}
      {authMode === 'bearer' && (
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            Access Token
          </label>
          <textarea
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
            placeholder="Paste your access token here..."
            disabled={isConnected || isLoading}
            rows={3}
            className="w-full px-4 py-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-50 placeholder:text-[var(--foreground-muted)] resize-none font-mono text-sm"
          />
        </div>
      )}

      {/* Advanced Options */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          Advanced options
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-[var(--background-tertiary)] rounded-xl border border-[var(--border)]">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAuthMode('none')}
                disabled={isConnected || isLoading}
                className={`p-3 rounded-lg border text-sm transition-all ${
                  authMode === 'none'
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                    : 'bg-[var(--background)] border-[var(--border)] hover:border-[var(--border-hover)]'
                } disabled:opacity-50`}
              >
                No Auth
              </button>
              <button
                onClick={() => setAuthMode('oauth-manual')}
                disabled={isConnected || isLoading}
                className={`p-3 rounded-lg border text-sm transition-all ${
                  authMode === 'oauth-manual'
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                    : 'bg-[var(--background)] border-[var(--border)] hover:border-[var(--border-hover)]'
                } disabled:opacity-50`}
              >
                Manual OAuth
              </button>
            </div>

            {authMode === 'oauth-manual' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Enter client ID"
                    disabled={isConnected || isLoading}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                    Client Secret (optional)
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Enter client secret"
                    disabled={isConnected || isLoading}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Connect Button */}
      <button
        onClick={handleConnect}
        disabled={isLoading || !serverUrl}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isAuthenticating ? 'Authenticating...' : 'Connecting...'}
          </>
        ) : (
          <>
            <Plug className="w-5 h-5" />
            Connect
          </>
        )}
      </button>

      {/* OAuth Hint */}
      {authMode === 'oauth' && (
        <p className="text-xs text-[var(--foreground-muted)] text-center">
          A popup window will open for authentication. Please allow popups for this site.
        </p>
      )}
    </div>
  );
}
