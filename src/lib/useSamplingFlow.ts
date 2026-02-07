'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { SamplingRequest, CreateMessageResult } from '@/lib/types';
import type { LLMSettings } from '@/lib/llm-types';

interface UseSamplingFlowOptions {
  respondToSamplingRequest: (
    serverId: string,
    requestId: string | number,
    result: CreateMessageResult | { error: { code: number; message: string } }
  ) => Promise<void>;
  llmSettings: LLMSettings;
}

export function useSamplingFlow({ respondToSamplingRequest, llmSettings }: UseSamplingFlowOptions) {
  const [pendingRequest, setPendingRequest] = useState<SamplingRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; content?: string; error?: string } | undefined>();

  const onSamplingRequest = useCallback((request: SamplingRequest) => {
    setPendingRequest(request);
    setResult(undefined);
  }, []);

  const handleApprove = useCallback(async () => {
    if (!pendingRequest) return;

    if (!llmSettings.activeProvider) {
      toast.error('No LLM provider configured. Please configure one in Chat settings.');
      return;
    }

    const providerConfig = llmSettings.providers[llmSettings.activeProvider];
    if (!providerConfig) {
      toast.error('LLM provider configuration not found.');
      return;
    }

    setIsProcessing(true);
    try {
      const messages = pendingRequest.params.messages.map(msg => {
        const content = Array.isArray(msg.content)
          ? msg.content.map(c => c.type === 'text' ? c.text : '').join('\n')
          : msg.content.type === 'text' ? msg.content.text : '';
        return { role: msg.role, content };
      });

      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: llmSettings.activeProvider,
          model: providerConfig.model,
          messages,
          systemPrompt: pendingRequest.params.systemPrompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'LLM request failed');
      }

      const data = await response.json();
      const resultContent = data.message?.content || '';

      const createResult: CreateMessageResult = {
        role: 'assistant',
        content: { type: 'text', text: resultContent },
        model: providerConfig.model,
        stopReason: 'endTurn',
      };

      await respondToSamplingRequest(
        pendingRequest.serverId,
        pendingRequest.id,
        createResult
      );

      setResult({ success: true, content: resultContent });
      toast.success('Sampling request completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResult({ success: false, error: errorMessage });

      await respondToSamplingRequest(
        pendingRequest.serverId,
        pendingRequest.id,
        { error: { code: -32000, message: errorMessage } }
      );

      toast.error(`Sampling failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pendingRequest, respondToSamplingRequest, llmSettings]);

  const handleDeny = useCallback(async () => {
    if (!pendingRequest) return;

    await respondToSamplingRequest(
      pendingRequest.serverId,
      pendingRequest.id,
      { error: { code: -32001, message: 'User denied sampling request' } }
    );

    setPendingRequest(null);
    setResult(undefined);
    toast.info('Sampling request denied');
  }, [pendingRequest, respondToSamplingRequest]);

  return {
    pendingRequest,
    isProcessing,
    result,
    onSamplingRequest,
    handleApprove,
    handleDeny,
  };
}
