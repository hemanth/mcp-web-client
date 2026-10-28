'use client';

import { useState, memo, useMemo } from 'react';
import { Bell, Play, Square, Trash2, ChevronDown, ChevronRight, Clock, Zap, Globe, Radio } from 'lucide-react';
import type { MCPEventType, EventSubscription } from '@/lib/types';

interface EventsPanelProps {
  eventTypes: MCPEventType[];
  subscriptions: EventSubscription[];
  serverId: string;
  onStartPoll: (serverId: string, eventName: string, args: Record<string, unknown>) => void;
  onStopPoll: (serverId: string, eventName: string, args: Record<string, unknown>) => void;
  onClearHistory: (serverId: string, eventName: string, args: Record<string, unknown>) => void;
  disabled?: boolean;
}

const deliveryIcon = (mode: string) => {
  switch (mode) {
    case 'poll': return <Clock className="w-3 h-3" />;
    case 'push': return <Zap className="w-3 h-3" />;
    case 'webhook': return <Globe className="w-3 h-3" />;
    default: return null;
  }
};

const EventTypeCard = memo(function EventTypeCard({
  eventType,
  subscription,
  serverId,
  onStartPoll,
  onStopPoll,
  onClearHistory,
  disabled,
}: {
  eventType: MCPEventType;
  subscription?: EventSubscription;
  serverId: string;
  onStartPoll: EventsPanelProps['onStartPoll'];
  onStopPoll: EventsPanelProps['onStopPoll'];
  onClearHistory: EventsPanelProps['onClearHistory'];
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [showEvents, setShowEvents] = useState(true);

  const supportsPoll = eventType.delivery.includes('poll');
  const properties = eventType.inputSchema?.properties || {};
  const isPolling = subscription?.active ?? false;
  const events = subscription?.receivedEvents || [];

  const handleStartPoll = () => {
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
    onStartPoll(serverId, eventType.name, parsedArgs);
  };

  const handleStopPoll = () => {
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
    onStopPoll(serverId, eventType.name, parsedArgs);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--background-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{eventType.name}</span>
              {isPolling && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px]">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  polling
                </span>
              )}
            </div>
            {eventType.description && (
              <p className="text-xs text-[var(--foreground-muted)] truncate max-w-xs">{eventType.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Delivery mode badges */}
          <div className="flex gap-1">
            {eventType.delivery.map(mode => (
              <span
                key={mode}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--background-tertiary)] text-[var(--foreground-muted)]"
              >
                {deliveryIcon(mode)}
                {mode}
              </span>
            ))}
          </div>
          {events.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
              {events.length}
            </span>
          )}
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--border)]">
          {/* Subscription arguments */}
          {Object.keys(properties).length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-[var(--foreground-muted)] font-medium">Subscription Arguments</p>
              {Object.entries(properties).map(([key, schema]) => {
                const s = schema as Record<string, unknown>;
                return (
                  <div key={key}>
                    <label className="text-xs text-[var(--foreground-subtle)]">
                      {key}
                      {typeof s.description === 'string' && <span className="ml-1 text-[var(--foreground-muted)]">- {s.description}</span>}
                    </label>
                    <input
                      type="text"
                      value={args[key] || ''}
                      onChange={e => setArgs(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={s.default != null ? String(s.default) : `${s.type || 'string'}`}
                      disabled={isPolling}
                      className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Poll controls */}
          {supportsPoll && (
            <div className="mt-3 flex items-center gap-2">
              {!isPolling ? (
                <button
                  onClick={handleStartPoll}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Start Polling
                </button>
              ) : (
                <button
                  onClick={handleStopPoll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              )}
              {events.length > 0 && (
                <button
                  onClick={() => onClearHistory(serverId, eventType.name, {})}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
              {isPolling && subscription && (
                <span className="text-[10px] text-[var(--foreground-muted)]">
                  next poll in {Math.round(subscription.nextPollMs / 1000)}s
                </span>
              )}
            </div>
          )}

          {!supportsPoll && (
            <p className="mt-3 text-xs text-[var(--foreground-muted)]">
              This event type only supports {eventType.delivery.join(', ')} delivery. Poll is not available.
            </p>
          )}

          {/* Event feed */}
          {events.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowEvents(!showEvents)}
                className="flex items-center gap-1 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                {showEvents ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Events ({events.length})
              </button>

              {showEvents && (
                <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                  {[...events].reverse().map((event, i) => (
                    <div
                      key={`${event.eventId}-${i}`}
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2.5"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-[var(--foreground-muted)]">{event.eventId}</span>
                        <span className="text-[10px] text-[var(--foreground-muted)]">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="text-xs text-[var(--foreground)] overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payload schema preview */}
          {eventType.payloadSchema && (
            <details className="mt-3">
              <summary className="text-[10px] text-[var(--foreground-muted)] cursor-pointer hover:text-[var(--foreground)]">
                Payload Schema
              </summary>
              <pre className="mt-1 text-[10px] text-[var(--foreground-muted)] overflow-x-auto p-2 rounded bg-[var(--background)]">
                {JSON.stringify(eventType.payloadSchema, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
});

export function EventsPanel({
  eventTypes,
  subscriptions,
  serverId,
  onStartPoll,
  onStopPoll,
  onClearHistory,
  disabled,
}: EventsPanelProps) {
  const subMap = useMemo(() => {
    const map = new Map<string, EventSubscription>();
    for (const sub of subscriptions) {
      if (sub.serverId === serverId) {
        map.set(`${sub.eventName}:${JSON.stringify(sub.arguments)}`, sub);
      }
    }
    return map;
  }, [subscriptions, serverId]);

  if (eventTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 mx-auto rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-4 md:mb-6">
          <Bell className="w-8 h-8 md:w-10 md:h-10 text-[var(--foreground-muted)]" />
        </div>
        <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3">No Events Available</h3>
        <p className="text-sm md:text-base text-[var(--foreground-muted)]">
          This server does not expose any event types.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-[var(--foreground-muted)]">
          Event Types ({eventTypes.length})
        </h2>
        <span className="text-[10px] text-[var(--foreground-muted)] px-2 py-0.5 rounded bg-[var(--background-secondary)]">
          SEP-3415
        </span>
      </div>
      {eventTypes.map(eventType => {
        const sub = subMap.get(`${eventType.name}:${JSON.stringify({})}`);
        return (
          <EventTypeCard
            key={eventType.name}
            eventType={eventType}
            subscription={sub}
            serverId={serverId}
            onStartPoll={onStartPoll}
            onStopPoll={onStopPoll}
            onClearHistory={onClearHistory}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}
