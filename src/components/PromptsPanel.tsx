'use client';

import { useState } from 'react';
import { BookOpen, Send, Loader2, ChevronDown, ChevronRight, AlertCircle, Copy, Check } from 'lucide-react';
import type { MCPPrompt } from '@/lib/types';

interface PromptsPanelProps {
  prompts: MCPPrompt[];
  onGetPrompt: (name: string, args?: Record<string, string>) => Promise<unknown>;
  disabled?: boolean;
}

interface PromptCardProps {
  prompt: MCPPrompt;
  onGet: (args?: Record<string, string>) => Promise<unknown>;
  disabled?: boolean;
}

function PromptCard({ prompt, onGet, disabled }: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGet = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const filteredArgs = Object.fromEntries(
        Object.entries(args).filter(([, value]) => value.trim())
      );
      const promptResult = await onGet(Object.keys(filteredArgs).length > 0 ? filteredArgs : undefined);
      setResult(typeof promptResult === 'string' ? promptResult : JSON.stringify(promptResult, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--background-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-left">
            <span className="font-medium text-sm">{prompt.name}</span>
            {prompt.description && (
              <p className="text-xs text-[var(--foreground-muted)] truncate max-w-xs">{prompt.description}</p>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--foreground-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--foreground-muted)]" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 border-t border-[var(--border)] space-y-4">
          {/* Arguments form */}
          {prompt.arguments && prompt.arguments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">Arguments</h4>
              {prompt.arguments.map((arg) => (
                <div key={arg.name}>
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)] mb-1">
                    {arg.name}
                    {arg.required && <span className="text-red-400 text-xs">*</span>}
                  </label>
                  {arg.description && (
                    <p className="text-xs text-[var(--foreground-muted)] mb-2">{arg.description}</p>
                  )}
                  <input
                    type="text"
                    value={args[arg.name] || ''}
                    onChange={(e) => setArgs({ ...args, [arg.name]: e.target.value })}
                    placeholder={`Enter ${arg.name}...`}
                    disabled={disabled || isLoading}
                    className="w-full px-3 py-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 placeholder:text-[var(--foreground-muted)]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Get button */}
          <button
            onClick={handleGet}
            disabled={disabled || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Get Prompt
              </>
            )}
          </button>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Result display */}
          {result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">Prompt Content</h4>
                <button
                  onClick={copyResult}
                  className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm overflow-auto max-h-96 font-mono text-xs whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PromptsPanel({ prompts, onGetPrompt, disabled }: PromptsPanelProps) {
  const [search, setSearch] = useState('');

  const filteredPrompts = prompts.filter(prompt =>
    prompt.name.toLowerCase().includes(search.toLowerCase()) ||
    prompt.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (prompts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-[var(--foreground-muted)]" />
        </div>
        <h3 className="text-lg font-medium mb-2">No Prompts Available</h3>
        <p className="text-sm text-[var(--foreground-muted)] max-w-sm">
          {disabled ? 'Connect to a server to see available prompts.' : 'This server doesn\'t expose any prompts.'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts..."
          className="w-full px-4 py-2 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--foreground-muted)]"
        />
      </div>

      {/* Prompts list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {filteredPrompts.map((prompt) => (
          <PromptCard
            key={prompt.name}
            prompt={prompt}
            onGet={(args) => onGetPrompt(prompt.name, args)}
            disabled={disabled}
          />
        ))}

        {filteredPrompts.length === 0 && search && (
          <div className="text-center py-8 text-[var(--foreground-muted)]">
            No prompts matching "{search}"
          </div>
        )}
      </div>
    </div>
  );
}
