'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { MCPTask, TaskStatus } from '@/lib/types';

interface TasksPanelProps {
  tasks: MCPTask[];
  serverId: string;
  onGetTask: (serverId: string, taskId: string) => Promise<MCPTask>;
  onCancelTask: (serverId: string, taskId: string) => Promise<void>;
  disabled?: boolean;
}

const statusConfig: Record<TaskStatus, { icon: typeof Loader2; color: string; bg: string; label: string }> = {
  working: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Working' },
  input_required: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Input Required' },
  completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Completed' },
  cancelled: { icon: XCircle, color: 'text-[var(--foreground-muted)]', bg: 'bg-[var(--background-tertiary)]', label: 'Cancelled' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
};

const TaskCard = memo(function TaskCard({
  task,
  serverId,
  onGetTask,
  onCancelTask,
  disabled,
}: {
  task: MCPTask;
  serverId: string;
  onGetTask: (serverId: string, taskId: string) => Promise<MCPTask>;
  onCancelTask: (serverId: string, taskId: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTask, setCurrentTask] = useState(task);
  const [pollingActive, setPollingActive] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const config = statusConfig[currentTask.status];
  const StatusIcon = config.icon;
  const isTerminal = ['completed', 'cancelled', 'failed'].includes(currentTask.status);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const updated = await onGetTask(serverId, currentTask.taskId);
      setCurrentTask(updated);
    } catch (err) {
      console.error('Failed to refresh task:', err);
    } finally {
      setRefreshing(false);
    }
  }, [serverId, currentTask.taskId, onGetTask]);

  // Auto-poll for active tasks
  useEffect(() => {
    if (!pollingActive || isTerminal) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    const interval = currentTask.pollIntervalMs || 2000;
    pollTimerRef.current = setInterval(async () => {
      try {
        const updated = await onGetTask(serverId, currentTask.taskId);
        setCurrentTask(updated);
        if (['completed', 'cancelled', 'failed'].includes(updated.status)) {
          setPollingActive(false);
        }
      } catch {
        setPollingActive(false);
      }
    }, interval);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pollingActive, isTerminal, currentTask.pollIntervalMs, currentTask.taskId, serverId, onGetTask]);

  const handleCancel = async () => {
    try {
      await onCancelTask(serverId, currentTask.taskId);
      await refresh();
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--background-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
            <StatusIcon className={`w-4 h-4 ${config.color} ${currentTask.status === 'working' ? 'animate-spin' : ''}`} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm font-mono">{currentTask.taskId.slice(0, 12)}...</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.color}`}>
                {config.label}
              </span>
            </div>
            {currentTask.statusMessage && (
              <p className="text-xs text-[var(--foreground-muted)] truncate max-w-xs">{currentTask.statusMessage}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setPollingActive(!pollingActive); }}
                className={`p-1 rounded ${pollingActive ? 'text-blue-400' : 'text-[var(--foreground-muted)]'} hover:bg-[var(--background-tertiary)]`}
                title={pollingActive ? 'Stop auto-poll' : 'Start auto-poll'}
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); refresh(); }}
                className="p-1 rounded text-[var(--foreground-muted)] hover:bg-[var(--background-tertiary)]"
                disabled={refreshing || disabled}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </>
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
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[var(--foreground-muted)]">Created:</span>{' '}
              <span>{new Date(currentTask.createdAt).toLocaleString()}</span>
            </div>
            {currentTask.lastUpdatedAt && (
              <div>
                <span className="text-[var(--foreground-muted)]">Updated:</span>{' '}
                <span>{new Date(currentTask.lastUpdatedAt).toLocaleString()}</span>
              </div>
            )}
            {currentTask.ttlMs != null && (
              <div>
                <span className="text-[var(--foreground-muted)]">TTL:</span>{' '}
                <span>{Math.round(currentTask.ttlMs / 1000)}s</span>
              </div>
            )}
          </div>

          {currentTask.result != null && (
            <div>
              <h4 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide mb-1">Result</h4>
              <pre className="text-xs bg-[var(--background-tertiary)] p-3 rounded-lg overflow-auto max-h-48 font-mono">
                {typeof currentTask.result === 'string' ? currentTask.result : JSON.stringify(currentTask.result, null, 2)}
              </pre>
            </div>
          )}

          {currentTask.error && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-xs">
              <span className="font-medium">Error {currentTask.error.code}:</span> {currentTask.error.message}
            </div>
          )}

          {!isTerminal && (
            <button
              onClick={handleCancel}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Cancel Task
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export function TasksPanel({ tasks, serverId, onGetTask, onCancelTask, disabled }: TasksPanelProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-6">
          <Clock className="w-8 h-8 text-[var(--foreground-muted)]" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Tasks</h3>
        <p className="text-sm text-[var(--foreground-muted)] max-w-sm">
          Async tasks from tool calls will appear here. Tasks are created when a server handles a long-running operation.
        </p>
      </div>
    );
  }

  const activeTasks = tasks.filter(t => !['completed', 'cancelled', 'failed'].includes(t.status));
  const completedTasks = tasks.filter(t => ['completed', 'cancelled', 'failed'].includes(t.status));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Tasks</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} ({activeTasks.length} active)
        </p>
      </div>

      {activeTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">Active</h3>
          {activeTasks.map(task => (
            <TaskCard
              key={task.taskId}
              task={task}
              serverId={serverId}
              onGetTask={onGetTask}
              onCancelTask={onCancelTask}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wide">Completed</h3>
          {completedTasks.map(task => (
            <TaskCard
              key={task.taskId}
              task={task}
              serverId={serverId}
              onGetTask={onGetTask}
              onCancelTask={onCancelTask}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
