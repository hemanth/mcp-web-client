'use client';

import { memo } from 'react';
import { Server, Wrench, FileText, BookOpen, X, Info } from 'lucide-react';
import type { MCPServerInfo, MCPCapabilities } from '@/lib/types';

interface ServerInfoProps {
  serverInfo?: MCPServerInfo;
  capabilities?: MCPCapabilities;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

export const ServerInfo = memo(function ServerInfo({
  serverInfo,
  capabilities,
  toolsCount,
  resourcesCount,
  promptsCount,
}: ServerInfoProps) {
  if (!serverInfo) {
    return null;
  }

  const capabilityItems = [
    { name: 'Tools', enabled: capabilities?.tools !== undefined, icon: Wrench, count: toolsCount, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
    { name: 'Resources', enabled: capabilities?.resources !== undefined, icon: FileText, count: resourcesCount, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { name: 'Prompts', enabled: capabilities?.prompts !== undefined, icon: BookOpen, count: promptsCount, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Server Info Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--success)]/10 flex items-center justify-center flex-shrink-0">
          <Server className="w-5 h-5 text-[var(--success)]" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{serverInfo.name}</h3>
          <p className="text-xs text-[var(--foreground-muted)]">v{serverInfo.version}</p>
        </div>
      </div>

      {/* Capabilities */}
      <div>
        <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide mb-3">
          Capabilities
        </h4>
        <div className="space-y-2">
          {capabilityItems.map((item) => (
            <div
              key={item.name}
              className={`flex items-center justify-between p-3 rounded-lg ${
                item.enabled ? item.bg : 'bg-[var(--background-tertiary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <item.icon className={`w-4 h-4 ${item.enabled ? item.color : 'text-[var(--foreground-muted)]'}`} />
                <span className={`text-sm ${item.enabled ? '' : 'text-[var(--foreground-muted)]'}`}>
                  {item.name}
                </span>
              </div>
              {item.enabled ? (
                <span className={`text-xs font-medium ${item.color}`}>
                  {item.count}
                </span>
              ) : (
                <X className="w-4 h-4 text-[var(--foreground-muted)]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-3 rounded-lg bg-[var(--background-tertiary)] border border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
          <Info className="w-3 h-3" />
          <span>Protocol 2024-11-05</span>
        </div>
      </div>
    </div>
  );
});
