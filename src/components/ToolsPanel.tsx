'use client';

import { useState, memo } from 'react';
import { Wrench, Play, Loader2, ChevronDown, ChevronRight, AlertCircle, Copy, Check } from 'lucide-react';
import type { MCPTool, ToolCallResult } from '@/lib/types';

interface ToolsPanelProps {
  tools: MCPTool[];
  onCallTool: (name: string, args: Record<string, unknown>) => Promise<ToolCallResult>;
  disabled?: boolean;
}

interface ToolCardProps {
  tool: MCPTool;
  onCall: (args: Record<string, unknown>) => Promise<ToolCallResult>;
  disabled?: boolean;
}

const ToolCard = memo(function ToolCard({ tool, onCall, disabled }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ToolCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const properties = tool.inputSchema.properties || {};
  const required = tool.inputSchema.required || [];

  const handleCall = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const parsedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        if (value.trim()) {
          try {
            parsedArgs[key] = JSON.parse(value);
          } catch {
            parsedArgs[key] = value;
          }
        }
      }

      const callResult = await onCall(parsedArgs);
      setResult(callResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tool call failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyResult = () => {
    if (result) {
      const text = result.content.map(item => item.type === 'text' ? item.text : '').join('\n');
      navigator.clipboard.writeText(text);
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
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-left">
            <span className="font-medium text-sm">{tool.name}</span>
            {tool.description && (
              <p className="text-xs text-[var(--foreground-muted)] truncate max-w-xs">{tool.description}</p>
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
          {Object.keys(properties).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">Arguments</h4>
              {Object.entries(properties).map(([name, schema]) => {
                const propSchema = schema as { type?: string; description?: string };
                const isRequired = required.includes(name);
                return (
                  <div key={name}>
                    <label className="flex items-center gap-2 text-sm text-[var(--foreground)] mb-1">
                      {name}
                      {isRequired && <span className="text-red-400 text-xs">*</span>}
                      {propSchema.type && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--background-tertiary)] text-[var(--foreground-muted)] text-xs">
                          {propSchema.type}
                        </span>
                      )}
                    </label>
                    {propSchema.description && (
                      <p className="text-xs text-[var(--foreground-muted)] mb-2">{propSchema.description}</p>
                    )}
                    <input
                      type="text"
                      value={args[name] || ''}
                      onChange={(e) => setArgs({ ...args, [name]: e.target.value })}
                      placeholder={propSchema.type === 'object' || propSchema.type === 'array' ? 'Enter JSON...' : `Enter ${propSchema.type || 'value'}...`}
                      disabled={disabled || isLoading}
                      className="w-full px-3 py-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 placeholder:text-[var(--foreground-muted)]"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Call button */}
          <button
            onClick={handleCall}
            disabled={disabled || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--success)] hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Execute
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
                <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">Result</h4>
                <button
                  onClick={copyResult}
                  className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className={`p-3 rounded-lg text-sm ${
                result.isError
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-[var(--background-tertiary)] border border-[var(--border)]'
              }`}>
                {result.content.map((item, index) => (
                  <div key={index} className="mb-2 last:mb-0">
                    {item.type === 'text' && (
                      <pre className="whitespace-pre-wrap font-mono text-xs overflow-x-auto">{item.text}</pre>
                    )}
                    {item.type === 'image' && item.data && (
                      <img
                        src={`data:${item.mimeType || 'image/png'};base64,${item.data}`}
                        alt="Tool result"
                        className="max-w-full rounded"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const ToolsPanel = memo(function ToolsPanel({ tools, onCallTool, disabled }: ToolsPanelProps) {
  const [search, setSearch] = useState('');

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(search.toLowerCase()) ||
    tool.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (tools.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-4">
          <Wrench className="w-8 h-8 text-[var(--foreground-muted)]" />
        </div>
        <h3 className="text-lg font-medium mb-2">No Tools Available</h3>
        <p className="text-sm text-[var(--foreground-muted)] max-w-sm">
          {disabled ? 'Connect to a server to see available tools.' : 'This server doesn\'t expose any tools.'}
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
          placeholder="Search tools..."
          className="w-full px-4 py-2 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--foreground-muted)]"
        />
      </div>

      {/* Tools list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {filteredTools.map((tool) => (
          <ToolCard
            key={tool.name}
            tool={tool}
            onCall={(args) => onCallTool(tool.name, args)}
            disabled={disabled}
          />
        ))}

        {filteredTools.length === 0 && search && (
          <div className="text-center py-8 text-[var(--foreground-muted)]">
            No tools matching "{search}"
          </div>
        )}
      </div>
    </div>
  );
});
