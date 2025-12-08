'use client';

import { useState, memo, useMemo, useRef, useEffect, useCallback } from 'react';
import { FileText, Eye, Loader2, ChevronDown, ChevronRight, AlertCircle, Copy, Check, Image, Code, FileCode, Globe, Download } from 'lucide-react';
import type { MCPResource, ResourceContentItem, ResourceReadResult } from '@/lib/types';

// SEP-1865: Check if content is an MCP App
function isMcpApp(mimeType?: string): boolean {
  return mimeType === 'text/html;profile=mcp-app' || mimeType?.includes('mcp-app') || false;
}

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

// Helper to determine content type category
function getContentCategory(mimeType?: string): 'image' | 'html' | 'json' | 'code' | 'text' {
  if (!mimeType) return 'text';
  if (mimeType.startsWith('image/')) return 'image';
  // Handle HTML including MCP UI HTML (text/html+mcp, text/html;profile=mcp-app)
  if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml' || mimeType.includes('html') || mimeType.includes('mcp-app')) return 'html';
  if (mimeType === 'application/json' || mimeType.endsWith('+json')) return 'json';
  if (mimeType.startsWith('text/') && ['javascript', 'css', 'xml', 'markdown'].some(t => mimeType.includes(t))) return 'code';
  return 'text';
}

// Helper to get icon for content type
function getContentIcon(mimeType?: string) {
  const category = getContentCategory(mimeType);
  switch (category) {
    case 'image': return Image;
    case 'html': return Globe;
    case 'json': return FileCode;
    case 'code': return Code;
    default: return FileText;
  }
}

// Component to render a single content item
function ContentRenderer({ item, resourceName }: { item: ResourceContentItem; resourceName: string }) {
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(400);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const category = getContentCategory(item.mimeType);
  const isApp = isMcpApp(item.mimeType);

  // SEP-1865: Handle postMessage communication from MCP App iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    // Validate message is from our iframe
    if (!iframeRef.current?.contentWindow || event.source !== iframeRef.current.contentWindow) {
      return;
    }

    const message = event.data;
    if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
      return;
    }

    console.log('[MCP App Host] Received message:', message);

    // Handle ui/initialize request per SEP-1865
    if (message.method === 'ui/initialize' && message.id) {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          hostContext: {
            theme: 'dark',
            displayMode: 'inline',
            platform: 'web',
            userAgent: 'MCP Web Client/1.0.0',
          },
        },
      };
      iframeRef.current.contentWindow.postMessage(response, '*');
      console.log('[MCP App Host] Sent ui/initialize response');
      return;
    }

    // Handle ui/open-link request per SEP-1865
    if (message.method === 'ui/open-link' && message.id) {
      const url = message.params?.url;
      if (url && typeof url === 'string') {
        try {
          window.open(url, '_blank', 'noopener,noreferrer');
          iframeRef.current.contentWindow.postMessage({
            jsonrpc: '2.0',
            id: message.id,
            result: {},
          }, '*');
        } catch {
          iframeRef.current.contentWindow.postMessage({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32000, message: 'Failed to open link' },
          }, '*');
        }
      }
      return;
    }

    // Handle ui/notifications/size-changed per SEP-1865
    if (message.method === 'ui/notifications/size-changed') {
      const height = message.params?.height;
      if (typeof height === 'number' && height > 0) {
        setIframeHeight(Math.min(Math.max(height, 200), 800));
      }
      return;
    }

    // Handle notifications/message (logging) per SEP-1865
    if (message.method === 'notifications/message') {
      console.log('[MCP App]', message.params?.message || message.params);
      return;
    }
  }, []);

  // Set up postMessage listener for MCP Apps
  useEffect(() => {
    if (isApp) {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isApp, handleMessage]);

  // Auto-resize iframe to fit content
  const handleIframeLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow?.document?.body) {
        const height = iframe.contentWindow.document.body.scrollHeight;
        setIframeHeight(Math.min(Math.max(height + 20, 200), 800));
      }
    } catch {
      // Cross-origin restriction, use default height
    }
  };

  const copyContent = () => {
    const textToCopy = item.text || item.blob || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadBlob = () => {
    if (!item.blob) return;
    const link = document.createElement('a');
    link.href = `data:${item.mimeType || 'application/octet-stream'};base64,${item.blob}`;
    link.download = resourceName || 'download';
    link.click();
  };

  // Render image content
  if (category === 'image' && item.blob) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">{item.mimeType}</span>
          <button
            onClick={downloadBlob}
            className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            <Download className="w-3 h-3" />
            Download
          </button>
        </div>
        <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background-tertiary)] p-2">
          <img
            src={`data:${item.mimeType};base64,${item.blob}`}
            alt={resourceName}
            className="max-w-full h-auto rounded"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
          />
        </div>
      </div>
    );
  }

  // Render HTML content (including MCP Apps per SEP-1865)
  if (category === 'html' && item.text) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--foreground-muted)]">{item.mimeType || 'text/html'}</span>
            {isApp && (
              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded font-medium">
                MCP App
              </span>
            )}
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="px-2 py-0.5 text-xs bg-[var(--background-tertiary)] hover:bg-[var(--border)] rounded transition-colors"
            >
              {showRaw ? 'Preview' : 'Raw'}
            </button>
          </div>
          <button
            onClick={copyContent}
            className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {showRaw ? (
          <pre className="p-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm overflow-auto max-h-96 font-mono text-xs">
            {item.text}
          </pre>
        ) : (
          <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-white">
            {/* SEP-1865: Sandboxed iframe with allow-scripts allow-same-origin */}
            <iframe
              ref={iframeRef}
              srcDoc={item.text}
              title={resourceName}
              className="w-full"
              sandbox="allow-scripts allow-same-origin"
              style={{ border: 'none', height: `${iframeHeight}px` }}
              onLoad={handleIframeLoad}
            />
          </div>
        )}
      </div>
    );
  }

  // Render JSON content with syntax highlighting
  if (category === 'json' && item.text) {
    let formattedJson = item.text;
    try {
      const parsed = JSON.parse(item.text);
      formattedJson = JSON.stringify(parsed, null, 2);
    } catch {
      // Keep original if not valid JSON
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">{item.mimeType || 'application/json'}</span>
          <button
            onClick={copyContent}
            className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="p-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm overflow-auto max-h-96 font-mono text-xs text-green-400">
          {formattedJson}
        </pre>
      </div>
    );
  }

  // Render code content
  if (category === 'code' && item.text) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">{item.mimeType}</span>
          <button
            onClick={copyContent}
            className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="p-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm overflow-auto max-h-96 font-mono text-xs text-blue-400">
          {item.text}
        </pre>
      </div>
    );
  }

  // Default text rendering
  const textContent = item.text || (item.blob ? atob(item.blob) : '');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--foreground-muted)]">{item.mimeType || 'text/plain'}</span>
        <button
          onClick={copyContent}
          className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm overflow-auto max-h-96 font-mono text-xs whitespace-pre-wrap">
        {textContent}
      </pre>
    </div>
  );
}

const ResourceCard = memo(function ResourceCard({ resource, onRead, disabled }: ResourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [contents, setContents] = useState<ResourceContentItem[] | null>(null);
  const [rawResult, setRawResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const Icon = useMemo(() => getContentIcon(resource.mimeType), [resource.mimeType]);

  const handleRead = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onRead();
      console.log('[ResourceCard] Raw result:', JSON.stringify(result, null, 2));
      setRawResult(result);

      // Parse the result - MCP returns { contents: [...] }
      if (result && typeof result === 'object' && 'contents' in result) {
        const readResult = result as ResourceReadResult;
        setContents(readResult.contents);
      } else if (Array.isArray(result)) {
        // Some servers return array directly
        setContents(result as ResourceContentItem[]);
      } else {
        // Fallback: wrap in a text content item
        setContents([{
          type: 'text',
          uri: resource.uri,
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          mimeType: resource.mimeType || 'text/plain',
        }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read resource');
    } finally {
      setIsLoading(false);
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
            <Icon className="w-4 h-4 text-blue-400" />
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
                {contents ? 'Refresh' : 'Read Resource'}
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
          {contents && contents.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">
                Content {contents.length > 1 && `(${contents.length} items)`}
              </h4>
              {contents.map((item, index) => (
                <ContentRenderer
                  key={`${item.uri}-${index}`}
                  item={item}
                  resourceName={resource.name}
                />
              ))}
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
