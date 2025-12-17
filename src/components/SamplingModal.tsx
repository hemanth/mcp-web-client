'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Bot,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Server,
  Thermometer,
  Hash,
} from 'lucide-react';
import type { SamplingRequest, SamplingMessage, SamplingMessageContent } from '@/lib/types';

interface SamplingModalProps {
  request: SamplingRequest;
  onApprove: () => void;
  onDeny: () => void;
  isProcessing: boolean;
  result?: {
    success: boolean;
    content?: string;
    error?: string;
  };
}

function formatContent(content: SamplingMessageContent | SamplingMessageContent[]): string {
  const contents = Array.isArray(content) ? content : [content];
  return contents
    .map((c) => {
      if (c.type === 'text') return c.text;
      if (c.type === 'image') return '[Image]';
      if (c.type === 'audio') return '[Audio]';
      return '[Unknown content]';
    })
    .join('\n');
}

function MessagePreview({ message }: { message: SamplingMessage }) {
  const content = formatContent(message.content);
  const isUser = message.role === 'user';

  return (
    <div
      className={`p-2.5 rounded-lg text-sm ${
        isUser
          ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20'
          : 'bg-[var(--background-tertiary)] border border-[var(--border)]'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`text-xs font-medium ${
            isUser ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'
          }`}
        >
          {isUser ? 'User' : 'Assistant'}
        </span>
      </div>
      <p className="text-[var(--foreground)] whitespace-pre-wrap break-words line-clamp-4">
        {content}
      </p>
    </div>
  );
}

export function SamplingModal({
  request,
  onApprove,
  onDeny,
  isProcessing,
  result,
}: SamplingModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const { params, serverName } = request;
  const messageCount = params.messages.length;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !isProcessing && onDeny()}
    >
      <div className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg">
              <Bot className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Sampling Request</h3>
              <p className="text-xs text-[var(--foreground-muted)]">
                Server wants to use the LLM
              </p>
            </div>
          </div>
          <button
            onClick={onDeny}
            disabled={isProcessing}
            className="p-1 hover:bg-[var(--background-tertiary)] rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Server Info */}
          <div className="flex items-center gap-2 p-2.5 bg-[var(--background-tertiary)] rounded-lg">
            <Server className="w-4 h-4 text-[var(--foreground-muted)]" />
            <span className="text-sm font-medium">{serverName}</span>
          </div>

          {/* Request Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--foreground-muted)]">Messages</span>
              <span className="font-medium">{messageCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--foreground-muted)]">Max Tokens</span>
              <span className="font-medium">{params.maxTokens}</span>
            </div>
            {params.temperature !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground-muted)] flex items-center gap-1">
                  <Thermometer className="w-3 h-3" />
                  Temperature
                </span>
                <span className="font-medium">{params.temperature}</span>
              </div>
            )}
            {params.systemPrompt && (
              <div className="text-sm">
                <span className="text-[var(--foreground-muted)]">System Prompt</span>
                <p className="mt-1 p-2 bg-[var(--background-tertiary)] rounded text-xs line-clamp-2">
                  {params.systemPrompt}
                </p>
              </div>
            )}
          </div>

          {/* Messages Preview */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors mb-2"
            >
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <MessageSquare className="w-4 h-4" />
              View Messages ({messageCount})
            </button>

            {showDetails && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {params.messages.map((msg, index) => (
                  <MessagePreview key={index} message={msg} />
                ))}
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div
              className={`p-3 rounded-lg border ${
                result.success
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {result.success ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span
                  className={`text-sm font-medium ${
                    result.success ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {result.success ? 'Completed' : 'Failed'}
                </span>
              </div>
              {result.content && (
                <p className="text-sm text-[var(--foreground)] line-clamp-4 whitespace-pre-wrap">
                  {result.content}
                </p>
              )}
              {result.error && (
                <p className="text-sm text-red-400">{result.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={onDeny}
            disabled={isProcessing || !!result}
            className="flex-1 px-3 py-2 bg-[var(--background-tertiary)] hover:bg-[var(--border)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={result ? onDeny : onApprove}
            disabled={isProcessing}
            className="flex-1 px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {result ? 'Close' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
