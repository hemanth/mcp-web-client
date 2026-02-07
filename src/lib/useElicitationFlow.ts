'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { ElicitationRequest, ElicitResult } from '@/lib/types';

interface UseElicitationFlowOptions {
  respondToElicitationRequest: (
    serverId: string,
    requestId: string | number,
    result: ElicitResult
  ) => Promise<void>;
}

export function useElicitationFlow({ respondToElicitationRequest }: UseElicitationFlowOptions) {
  const [pendingRequest, setPendingRequest] = useState<ElicitationRequest | null>(null);

  const onElicitationRequest = useCallback((request: ElicitationRequest) => {
    setPendingRequest(request);
  }, []);

  const handleSubmit = useCallback(async (result: ElicitResult) => {
    if (!pendingRequest) return;

    await respondToElicitationRequest(
      pendingRequest.serverId,
      pendingRequest.id,
      result
    );

    setPendingRequest(null);

    if (result.action === 'accept') {
      toast.success('Response submitted successfully');
    } else if (result.action === 'decline') {
      toast.info('Request declined');
    } else {
      toast.info('Request cancelled');
    }
  }, [pendingRequest, respondToElicitationRequest]);

  const handleDecline = useCallback(() => {
    setPendingRequest(null);
  }, []);

  const handleCancel = useCallback(() => {
    setPendingRequest(null);
  }, []);

  return {
    pendingRequest,
    onElicitationRequest,
    handleSubmit,
    handleDecline,
    handleCancel,
  };
}
