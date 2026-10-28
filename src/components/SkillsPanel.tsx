'use client';

import { useState, memo } from 'react';
import { BookMarked, FileText, ChevronDown, ChevronRight, Loader2, Shield, Copy, Check } from 'lucide-react';
import type { MCPSkill } from '@/lib/types';

interface SkillsPanelProps {
  skills: MCPSkill[];
  serverId: string;
  onGetContent: (serverId: string, uri: string) => Promise<string>;
  disabled?: boolean;
}

const SkillCard = memo(function SkillCard({
  skill,
  serverId,
  onGetContent,
  disabled,
}: {
  skill: MCPSkill;
  serverId: string;
  onGetContent: (serverId: string, uri: string) => Promise<string>;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExpand = async () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);

    if (newExpanded && content === null && !loading) {
      setLoading(true);
      try {
        const text = await onGetContent(serverId, skill.uri);
        setContent(text);
      } catch (err) {
        setContent(`Error loading skill: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const copyContent = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fileCount = skill.files?.length || 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] overflow-hidden">
      <button
        onClick={handleExpand}
        disabled={disabled}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--background-tertiary)] transition-colors disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
            <BookMarked className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-left">
            <span className="font-medium text-sm">{skill.name}</span>
            {skill.description && (
              <p className="text-xs text-[var(--foreground-muted)] truncate max-w-xs">{skill.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fileCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
              <FileText className="w-3 h-3" /> {fileCount}
            </span>
          )}
          {skill.files?.some(f => f.sha256) && (
            <span title="Integrity verified (SHA-256)">
              <Shield className="w-3.5 h-3.5 text-green-400" />
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--foreground-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--foreground-muted)]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-t border-[var(--border)] space-y-3">
          {/* URI */}
          <div className="text-xs">
            <span className="text-[var(--foreground-muted)]">URI:</span>{' '}
            <code className="px-1.5 py-0.5 rounded bg-[var(--background-tertiary)] font-mono">{skill.uri}</code>
          </div>

          {/* Files manifest */}
          {skill.files && skill.files.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide mb-2">Files</h4>
              <div className="space-y-1">
                {skill.files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-[var(--background-tertiary)]">
                    <FileText className="w-3 h-3 text-[var(--foreground-muted)]" />
                    <span className="font-mono flex-1 truncate">{f.uri}</span>
                    {f.size != null && (
                      <span className="text-[var(--foreground-muted)]">{(f.size / 1024).toFixed(1)}KB</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content preview */}
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading skill content...
            </div>
          ) : content !== null ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">SKILL.md</h4>
                <button
                  onClick={copyContent}
                  className="p-1 rounded text-[var(--foreground-muted)] hover:bg-[var(--background-tertiary)]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="text-xs bg-[var(--background-tertiary)] p-3 rounded-lg overflow-auto max-h-64 font-mono whitespace-pre-wrap">
                {content}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
});

export function SkillsPanel({ skills, serverId, onGetContent, disabled }: SkillsPanelProps) {
  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-6">
          <BookMarked className="w-8 h-8 text-[var(--foreground-muted)]" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Skills</h3>
        <p className="text-sm text-[var(--foreground-muted)] max-w-sm">
          Agent skills published by this server will appear here. Skills are structured workflow instructions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Skills</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          {skills.length} skill{skills.length !== 1 ? 's' : ''} available
        </p>
      </div>

      <div className="space-y-3">
        {skills.map(skill => (
          <SkillCard
            key={skill.uri}
            skill={skill}
            serverId={serverId}
            onGetContent={onGetContent}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
