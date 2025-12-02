'use client';

import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Check, X, Cpu, Zap, Brain, Server } from 'lucide-react';
import type { LLMProvider, LLMSettings, LLMProviderConfig } from '@/lib/llm-types';
import { LLM_PROVIDERS, DEFAULT_LLM_SETTINGS } from '@/lib/llm-types';

const STORAGE_KEY = 'llm-settings';

const PROVIDER_ICONS: Record<LLMProvider, React.ReactNode> = {
  openai: <Zap className="w-5 h-5" />,
  anthropic: <Brain className="w-5 h-5" />,
  gemini: <Cpu className="w-5 h-5" />,
  ollama: <Server className="w-5 h-5" />,
};

const PROVIDER_COLORS: Record<LLMProvider, string> = {
  openai: 'bg-green-500/10 text-green-400 border-green-500/20',
  anthropic: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  gemini: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ollama: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
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
  });
  const [testingProvider, setTestingProvider] = useState<LLMProvider | null>(null);
  const [testResults, setTestResults] = useState<Record<LLMProvider, 'success' | 'error' | null>>({
    openai: null,
    anthropic: null,
    gemini: null,
    ollama: null,
  });

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  if (!isOpen) return null;

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

                {/* API Key Input */}
                {providerInfo.requiresApiKey && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">
                      API Key
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

                {/* Base URL for Ollama */}
                {providerInfo.id === 'ollama' && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={config.baseUrl || providerInfo.defaultBaseUrl || ''}
                      onChange={(e) => updateProviderConfig(providerInfo.id, { baseUrl: e.target.value })}
                      placeholder={providerInfo.defaultBaseUrl}
                      className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                )}

                {/* Model Selection */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">
                    Model
                  </label>
                  <select
                    value={config.model}
                    onChange={(e) => updateProviderConfig(providerInfo.id, { model: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {providerInfo.models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                        {model.contextWindow && ` (${Math.round(model.contextWindow / 1000)}k context)`}
                      </option>
                    ))}
                  </select>
                </div>

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
        setSettings({
          ...DEFAULT_LLM_SETTINGS,
          ...parsed,
          providers: {
            ...DEFAULT_LLM_SETTINGS.providers,
            ...parsed.providers,
          },
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
