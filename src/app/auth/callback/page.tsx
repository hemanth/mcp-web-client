'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    async function handleCallback() {
      // Prevent double execution in React Strict Mode
      if (hasProcessedRef.current) {
        return;
      }
      hasProcessedRef.current = true;
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setMessage(`Authentication failed: ${errorDescription || error}`);
        // Notify parent window of error
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-error', error, errorDescription }, window.location.origin);
        }
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing authentication parameters');
        return;
      }

      try {
        // Exchange code for tokens via API
        const response = await fetch(`/api/auth/callback?code=${code}&state=${state}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Token exchange failed');
        }

        setStatus('success');
        setMessage('Authentication successful! You can close this window.');

        // Send tokens to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-success',
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            tokenType: data.tokenType,
            expiresAt: data.expiresAt,
            scope: data.scope,
            serverUrl: data.serverUrl,
          }, window.location.origin);

          // Close popup after short delay
          setTimeout(() => {
            window.close();
          }, 1500);
        }
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Authentication failed');

        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            error: err instanceof Error ? err.message : 'Unknown error',
          }, window.location.origin);
        }
      }
    }

    handleCallback();
  }, [searchParams]);

  return (
    <div className="max-w-md w-full p-8 bg-[var(--background-secondary)] rounded-xl border border-[var(--border)] text-center">
      {status === 'processing' && (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4" />
          <p className="text-[var(--foreground-muted)]">{message}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-400 font-medium">{message}</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="h-12 w-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-400 font-medium">{message}</p>
          <button
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-[var(--background-tertiary)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            Close Window
          </button>
        </>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="max-w-md w-full p-8 bg-[var(--background-secondary)] rounded-xl border border-[var(--border)] text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4" />
      <p className="text-[var(--foreground-muted)]">Loading...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <Suspense fallback={<LoadingFallback />}>
        <AuthCallbackContent />
      </Suspense>
    </div>
  );
}
