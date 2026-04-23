'use client';

import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Check, X, Cpu, Zap, Brain, Server, Globe, Plus, Trash2, ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import type { LLMProvider, LLMSettings, LLMProviderConfig } from '@/lib/llm-types';
import { LLM_PROVIDERS, DEFAULT_LLM_SETTINGS, ALL_PROVIDER_KEYS } from '@/lib/llm-types';

const STORAGE_KEY = 'llm-settings';

// Extracted model combobox component (needs its own state)
function ModelCombobox({
  models,
  value,
  onChange,
  placeholder,
}: {
  models: { id: string; name: string; contextWindow?: number }[];
  value: string;
  onChange: (model: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = models.filter(m =>
    !filter ||
    m.id.toLowerCase().includes(filter.toLowerCase()) ||
    m.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setFilter(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFilter(value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)] pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg shadow-xl">
          {filtered.map(model => (
            <button
              key={model.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(model.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--background-tertiary)] transition-colors flex items-center justify-between ${
                value === model.id ? 'text-[var(--accent)]' : ''
              }`}
            >
              <span className="truncate">{model.name}</span>
              <span className="text-xs text-[var(--foreground-muted)] ml-2 flex-shrink-0">
                {model.contextWindow ? `${Math.round(model.contextWindow / 1000)}k` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PROVIDER_ICONS: Record<LLMProvider, React.ReactNode> = {
  openai: <Zap className="w-5 h-5" />,
  anthropic: <Brain className="w-5 h-5" />,
  gemini: <Cpu className="w-5 h-5" />,
  ollama: <Server className="w-5 h-5" />,
  nvidia: <Cpu className="w-5 h-5" />,
  custom: <Globe className="w-5 h-5" />,
};

const PROVIDER_COLORS: Record<LLMProvider, string> = {
  openai: 'bg-green-500/10 text-green-400 border-green-500/20',
  anthropic: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  gemini: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ollama: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  nvidia: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  custom: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

interface LLMSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: LLMSettings) => void;
  currentSettings: LLMSettings;
}

export function LLMSettingsModal({ isOpen, onClose, onSettingsChange, currentSettings }: LLMSettingsProps) {
  const [settings, setSettings] = useState<LLMSettings>(currentSettings);
  const [showApiKeys, setShowApiKeys] = useState<Record<LLMProvider, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
    ollama: false,
    nvidia: false,
    custom: false,
  });
  const [testingProvider, setTestingProvider] = useState<LLMProvider | null>(null);
  const [testResults, setTestResults] = useState<Record<LLMProvider, 'success' | 'error' | null>>({
    openai: null,
    anthropic: null,
    gemini: null,
    ollama: null,
    nvidia: null,
    custom: null,
  });

  const [fetchedModels, setFetchedModels] = useState<Record<string, { id: string; name: string; contextWindow?: number }[]>>({});
  const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  if (!isOpen) return null;

  const fetchModels = async (provider: LLMProvider) => {
    const config = settings.providers[provider];
    setFetchingModels(prev => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch('/api/llm/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      const { models } = await res.json();
      setFetchedModels(prev => ({ ...prev, [provider]: models }));
    } catch (err) {
      console.error(`Failed to fetch ${provider} models:`, err);
    } finally {
      setFetchingModels(prev => ({ ...prev, [provider]: false }));
    }
  };

  const updateProviderConfig = (provider: LLMProvider, updates: Partial<LLMProviderConfig>) => {
    setSettings(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: {
          ...prev.providers[provider],
          ...updates,
        },
      },
    }));
  };

  const setActiveProvider = (provider: LLMProvider | null) => {
    setSettings(prev => ({
      ...prev,
      activeProvider: provider,
    }));
  };

  const toggleApiKeyVisibility = (provider: LLMProvider) => {
    setShowApiKeys(prev => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  const addCustomHeader = (provider: LLMProvider) => {
    const config = settings.providers[provider];
    const headers = { ...(config.customHeaders || {}) };
    headers[`X-Header-${Object.keys(headers).length + 1}`] = '';
    updateProviderConfig(provider, { customHeaders: headers });
  };

  const updateCustomHeader = (provider: LLMProvider, oldKey: string, newKey: string, value: string) => {
    const config = settings.providers[provider];
    const headers = { ...(config.customHeaders || {}) };
    if (oldKey !== newKey) {
      delete headers[oldKey];
    }
    headers[newKey] = value;
    updateProviderConfig(provider, { customHeaders: headers });
  };

  const removeCustomHeader = (provider: LLMProvider, key: string) => {
    const config = settings.providers[provider];
    const headers = { ...(config.customHeaders || {}) };
    delete headers[key];
    updateProviderConfig(provider, { customHeaders: headers });
  };

  const testConnection = async (provider: LLMProvider) => {
    setTestingProvider(provider);
    setTestResults(prev => ({ ...prev, [provider]: null }));

    try {
      const config = settings.providers[provider];
      const response = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: config.model,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          customHeaders: config.customHeaders,
        }),
      });

      if (response.ok) {
        setTestResults(prev => ({ ...prev, [provider]: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, [provider]: 'error' }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, [provider]: 'error' }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSave = () => {
    onSettingsChange(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">LLM Settings</h2>
              <p className="text-sm text-[var(--foreground-muted)]">Configure AI providers for chat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--background-secondary)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {LLM_PROVIDERS.map(providerInfo => {
            const config = settings.providers[providerInfo.id];
            const isActive = settings.activeProvider === providerInfo.id;
            const testResult = testResults[providerInfo.id];
            const isCustom = providerInfo.id === 'custom';
            const showBaseUrl = providerInfo.id === 'ollama' || providerInfo.id === 'nvidia' || providerInfo.id === 'custom';

            return (
              <div
                key={providerInfo.id}
                className={`rounded-xl border p-4 transition-colors ${
                  isActive
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border)] bg-[var(--background-secondary)]'
                }`}
              >
                {/* Provider Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${PROVIDER_COLORS[providerInfo.id]}`}>
                      {PROVIDER_ICONS[providerInfo.id]}
                    </div>
                    <div>
                      <h3 className="font-medium">{providerInfo.name}</h3>
                      <p className="text-xs text-[var(--foreground-muted)]">{providerInfo.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveProvider(isActive ? null : providerInfo.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--background-tertiary)] hover:bg-[var(--border)]'
                    }`}
                  >
                    {isActive ? 'Active' : 'Select'}
                  </button>
                </div>

                {/* Base URL (for ollama, nvidia, custom) */}
                {showBaseUrl && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">
                      Base URL {isCustom && <span className="text-red-400">*</span>}
                    </label>
                    <input
                      type="text"
                      value={config.baseUrl || providerInfo.defaultBaseUrl || ''}
                      onChange={(e) => updateProviderConfig(providerInfo.id, { baseUrl: e.target.value })}
                      placeholder={providerInfo.defaultBaseUrl || 'https://your-endpoint.com/v1'}
                      className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                )}

                {/* API Key Input */}
                {(providerInfo.requiresApiKey || isCustom) && (
                  <div className="mb-3">
                    <label className="flex items-center justify-between text-xs font-medium text-[var(--foreground-muted)] mb-1.5">
                      <span>API Key {!providerInfo.requiresApiKey && '(optional)'}</span>
                      {providerInfo.apiKeyUrl && (
                        <a
                          href={providerInfo.apiKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] hover:underline"
                        >
                          Get API Key →
                        </a>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKeys[providerInfo.id] ? 'text' : 'password'}
                        value={config.apiKey || ''}
                        onChange={(e) => updateProviderConfig(providerInfo.id, { apiKey: e.target.value })}
                        placeholder={`Enter your ${providerInfo.name} API key`}
                        className="w-full px-3 py-2 pr-10 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <button
                        onClick={() => toggleApiKeyVisibility(providerInfo.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                      >
                        {showApiKeys[providerInfo.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Model Selection - editable combobox */}
                {(() => {
                  // Merge fetched models with defaults (fetched take priority)
                  const fetched = fetchedModels[providerInfo.id];
                  const mergedModels = fetched && fetched.length > 0
                    ? fetched
                    : providerInfo.models;
                  const canFetch = providerInfo.id !== 'custom' && providerInfo.id !== 'anthropic';
                  const isFetching = fetchingModels[providerInfo.id];

                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-[var(--foreground-muted)]">
                          Model
                          {fetched && fetched.length > 0 && (
                            <span className="ml-1.5 text-[var(--accent)]">
                              ({fetched.length} live)
                            </span>
                          )}
                        </label>
                        {canFetch && (
                          <button
                            onClick={() => fetchModels(providerInfo.id)}
                            disabled={isFetching || (!config.apiKey && providerInfo.requiresApiKey)}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={config.apiKey ? 'Fetch latest models from API' : 'Enter API key first'}
                          >
                            {isFetching ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            {isFetching ? 'Fetching…' : 'Refresh'}
                          </button>
                        )}
                      </div>
                      <ModelCombobox
                        models={mergedModels}
                        value={config.model || ''}
                        onChange={(model) => updateProviderConfig(providerInfo.id, { model })}
                        placeholder={isCustom ? 'e.g. gpt-4o, llama-3.3-70b' : 'Type or select a model'}
                      />
                    </div>
                  );
                })()}

                {/* Custom Headers (for custom provider) */}
                {isCustom && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-[var(--foreground-muted)]">
                        Custom Headers
                      </label>
                      <button
                        onClick={() => addCustomHeader(providerInfo.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-md transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    {Object.entries(config.customHeaders || {}).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(config.customHeaders || {}).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={key}
                              onChange={(e) => updateCustomHeader(providerInfo.id, key, e.target.value, value)}
                              placeholder="Header name"
                              className="flex-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            />
                            <span className="text-[var(--foreground-muted)] text-xs">:</span>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => updateCustomHeader(providerInfo.id, key, key, e.target.value)}
                              placeholder="Value"
                              className="flex-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            />
                            <button
                              onClick={() => removeCustomHeader(providerInfo.id, key)}
                              className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--foreground-muted)] italic">
                        No custom headers. Add headers for auth tokens, org IDs, etc.
                      </p>
                    )}
                  </div>
                )}

                {/* Test Connection */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testConnection(providerInfo.id)}
                    disabled={testingProvider === providerInfo.id || (providerInfo.requiresApiKey && !config.apiKey)}
                    className="px-3 py-1.5 bg-[var(--background-tertiary)] hover:bg-[var(--border)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingProvider === providerInfo.id ? 'Testing...' : 'Test Connection'}
                  </button>
                  {testResult === 'success' && (
                    <span className="flex items-center gap-1 text-green-400 text-sm">
                      <Check className="w-4 h-4" /> Connected
                    </span>
                  )}
                  {testResult === 'error' && (
                    <span className="flex items-center gap-1 text-red-400 text-sm">
                      <X className="w-4 h-4" /> Failed
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* System Prompt */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] p-4">
            <label className="block text-sm font-medium mb-2">System Prompt (Optional)</label>
            <textarea
              value={settings.systemPrompt || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
              placeholder="Enter a custom system prompt for the AI assistant..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium hover:bg-[var(--background-secondary)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to manage LLM settings
export function useLLMSettings() {
  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_LLM_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new providers
        const mergedProviders = { ...DEFAULT_LLM_SETTINGS.providers };
        for (const key of ALL_PROVIDER_KEYS) {
          if (parsed.providers?.[key]) {
            mergedProviders[key] = { ...mergedProviders[key], ...parsed.providers[key] };
          }
        }
        setSettings({
          ...DEFAULT_LLM_SETTINGS,
          ...parsed,
          providers: mergedProviders,
        });
      }
    } catch {
      // Use defaults
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when settings change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings, isLoaded]);

  const updateSettings = (newSettings: LLMSettings) => {
    setSettings(newSettings);
  };

  const getActiveConfig = (): LLMProviderConfig | null => {
    if (!settings.activeProvider) return null;
    return settings.providers[settings.activeProvider];
  };

  return {
    settings,
    updateSettings,
    getActiveConfig,
    isLoaded,
  };
}
