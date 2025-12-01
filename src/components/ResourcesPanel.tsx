'use client';

import { useState, memo } from 'react';
import { FileText, Eye, Loader2, ChevronDown, ChevronRight, AlertCircle, Copy, Check } from 'lucide-react';
import type { MCPResource } from '@/lib/types';

interface ResourcesPanelProps {
  resources: MCPResource[];
  onReadResource: (uri: string) => Promise<unknown>;
  disabled?: boolean;
}

interface ResourceCardProps {
  resource: MCPResource;
  onRead: () => Promise<unknown>;
  disabled?: boolean;
}

const ResourceCard = memo(function ResourceCard({ resource, onRead, disabled }: ResourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRead = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onRead();
      setContent(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read resource');
    } finally {
      setIsLoading(false);
    }
  };

  const copyContent = () => {
    if (content) {
      navigator.clipboard.writeText(content);
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
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <span className="font-medium text-sm">{resource.name}</span>
            {resource.mimeType && (
              <span className="ml-2 px-2 py-0.5 rounded bg-[var(--background-tertiary)] text-[var(--foreground-muted)] text-xs">
                {resource.mimeType}
              </span>
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
          {/* URI */}
          <div>
            <span className="text-xs text-[var(--foreground-muted)]">URI</span>
            <code className="block mt-1 text-xs bg-[var(--background-tertiary)] px-3 py-2 rounded-lg overflow-x-auto">
              {resource.uri}
            </code>
          </div>

          {/* Description */}
          {resource.description && (
            <p className="text-sm text-[var(--foreground-muted)]">{resource.description}</p>
          )}

          {/* Read button */}
          <button
            onClick={handleRead}
            disabled={disabled || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reading...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Read Resource
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

          {/* Content display */}
          {content && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">Content</h4>
                <button
                  onClick={copyContent}
                  className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm overflow-auto max-h-96 font-mono text-xs">
                {content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const ResourcesPanel = memo(function ResourcesPanel({ resources, onReadResource, disabled }: ResourcesPanelProps) {
  const [search, setSearch] = useState('');

  const filteredResources = resources.filter(resource =>
    resource.name.toLowerCase().includes(search.toLowerCase()) ||
    resource.uri.toLowerCase().includes(search.toLowerCase()) ||
    resource.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (resources.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-[var(--foreground-muted)]" />
        </div>
        <h3 className="text-lg font-medium mb-2">No Resources Available</h3>
        <p className="text-sm text-[var(--foreground-muted)] max-w-sm">
          {disabled ? 'Connect to a server to see available resources.' : 'This server doesn\'t expose any resources.'}
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
          placeholder="Search resources..."
          className="w-full px-4 py-2 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--foreground-muted)]"
        />
      </div>

      {/* Resources list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {filteredResources.map((resource) => (
          <ResourceCard
            key={resource.uri}
            resource={resource}
            onRead={() => onReadResource(resource.uri)}
            disabled={disabled}
          />
        ))}

        {filteredResources.length === 0 && search && (
          <div className="text-center py-8 text-[var(--foreground-muted)]">
            No resources matching "{search}"
          </div>
        )}
      </div>
    </div>
  );
});
