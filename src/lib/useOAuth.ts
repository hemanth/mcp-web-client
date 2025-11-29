'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { OAuthCredentials, OAuthClientRegistration } from './types';

interface StoredCredentials {
  serverUrl: string;
  credentials: OAuthCredentials;
  clientRegistration?: OAuthClientRegistration;
}

interface StoredClientRegistration {
  clientId: string;
  clientSecret?: string;
  serverUrl: string;
}

const STORAGE_KEY = 'mcp-client-oauth';
const REGISTRATION_STORAGE_KEY = 'mcp-client-registrations';

export function useOAuth() {
  const [credentials, setCredentials] = useState<Map<string, StoredCredentials>>(new Map());
  const [clientRegistrations, setClientRegistrations] = useState<Map<string, StoredClientRegistration>>(new Map());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authWindowRef = useRef<Window | null>(null);

  // Load credentials and registrations from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredCredentials[];
        const map = new Map(parsed.map(item => [item.serverUrl, item]));
        setCredentials(map);
      }
    } catch (error) {
      console.error('Failed to load OAuth credentials:', error);
    }

    try {
      const storedRegs = localStorage.getItem(REGISTRATION_STORAGE_KEY);
      if (storedRegs) {
        const parsed = JSON.parse(storedRegs) as StoredClientRegistration[];
        const map = new Map(parsed.map(item => [item.serverUrl, item]));
        setClientRegistrations(map);
      }
    } catch (error) {
      console.error('Failed to load client registrations:', error);
    }
  }, []);

  // Save credentials to localStorage
  const saveCredentials = useCallback((serverUrl: string, creds: OAuthCredentials, registration?: OAuthClientRegistration) => {
    // Normalize URL - remove /sse suffix if present
    const normalizedUrl = serverUrl.replace(/\/sse$/, '');
    setCredentials(prev => {
      const next = new Map(prev);
      next.set(normalizedUrl, { serverUrl: normalizedUrl, credentials: creds, clientRegistration: registration });

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next.values())));
      } catch (error) {
        console.error('Failed to save OAuth credentials:', error);
      }

      return next;
    });
  }, []);

  // Get credentials for a server
  const getCredentials = useCallback((serverUrl: string): OAuthCredentials | undefined => {
    // Normalize URL - remove /sse suffix if present
    const normalizedUrl = serverUrl.replace(/\/sse$/, '');
    const stored = credentials.get(normalizedUrl);
    if (stored) {
      // Check if token is expired
      if (stored.credentials.expiresAt && Date.now() > stored.credentials.expiresAt) {
        // Token expired - would need refresh logic here
        return undefined;
      }
      return stored.credentials;
    }
    return undefined;
  }, [credentials]);

  // Clear credentials for a server
  const clearCredentials = useCallback((serverUrl: string) => {
    setCredentials(prev => {
      const next = new Map(prev);
      next.delete(serverUrl);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next.values())));
      } catch (error) {
        console.error('Failed to save OAuth credentials:', error);
      }

      return next;
    });
  }, []);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'oauth-success') {
        const { accessToken, refreshToken, tokenType, expiresAt, serverUrl } = event.data;
        saveCredentials(serverUrl, {
          accessToken,
          refreshToken,
          tokenType,
          expiresAt,
        });
        setIsAuthenticating(false);
        authWindowRef.current?.close();
        authWindowRef.current = null;
      } else if (event.data.type === 'oauth-error') {
        console.error('OAuth error:', event.data.error);
        setIsAuthenticating(false);
        authWindowRef.current?.close();
        authWindowRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [saveCredentials]);

  // Save client registration to localStorage
  const saveClientRegistration = useCallback((serverUrl: string, clientId: string, clientSecret?: string) => {
    const normalizedUrl = serverUrl.replace(/\/sse$/, '');
    setClientRegistrations(prev => {
      const next = new Map(prev);
      next.set(normalizedUrl, { serverUrl: normalizedUrl, clientId, clientSecret });

      try {
        localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(Array.from(next.values())));
      } catch (error) {
        console.error('Failed to save client registration:', error);
      }

      return next;
    });
  }, []);

  // Get client registration for a server
  const getClientRegistration = useCallback((serverUrl: string): StoredClientRegistration | undefined => {
    const normalizedUrl = serverUrl.replace(/\/sse$/, '');
    return clientRegistrations.get(normalizedUrl);
  }, [clientRegistrations]);

  // Register client with server (dynamic registration)
  const registerClient = useCallback(async (serverUrl: string): Promise<{ success: boolean; clientId?: string; clientSecret?: string; error?: string }> => {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      // Save registration to localStorage for persistence across server restarts
      saveClientRegistration(serverUrl, data.clientId, data.clientSecret);

      return { success: true, clientId: data.clientId, clientSecret: data.clientSecret };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Registration failed' };
    }
  }, [saveClientRegistration]);

  // Start OAuth flow
  const startOAuth = useCallback(async (serverUrl: string, clientId?: string, clientSecret?: string): Promise<{ success: boolean; error?: string }> => {
    setIsAuthenticating(true);

    try {
      // If clientId/clientSecret not provided, try to get from stored registrations
      let effectiveClientId = clientId;
      let effectiveClientSecret = clientSecret;

      if (!effectiveClientId) {
        const storedReg = getClientRegistration(serverUrl);
        if (storedReg) {
          effectiveClientId = storedReg.clientId;
          effectiveClientSecret = storedReg.clientSecret;
          console.log('Using stored client registration:', effectiveClientId);
        }
      }

      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl, clientId: effectiveClientId, clientSecret: effectiveClientSecret }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIsAuthenticating(false);
        return { success: false, error: data.error };
      }

      if (!data.requiresAuth) {
        // Server doesn't require OAuth
        setIsAuthenticating(false);
        return { success: true };
      }

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      authWindowRef.current = window.open(
        data.authUrl,
        'mcp-oauth',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      if (!authWindowRef.current) {
        setIsAuthenticating(false);
        return { success: false, error: 'Failed to open popup window. Please allow popups.' };
      }

      // The result will be handled by the message event listener
      return { success: true };
    } catch (error) {
      setIsAuthenticating(false);
      return { success: false, error: error instanceof Error ? error.message : 'OAuth failed' };
    }
  }, [getClientRegistration]);

  // Authenticate with bearer token directly
  const setBearerToken = useCallback((serverUrl: string, token: string) => {
    saveCredentials(serverUrl, {
      accessToken: token,
      tokenType: 'Bearer',
    });
  }, [saveCredentials]);

  // Clear all credentials and registrations for a server
  const clearAllForServer = useCallback((serverUrl: string) => {
    const normalizedUrl = serverUrl.replace(/\/sse$/, '');

    // Clear credentials
    clearCredentials(normalizedUrl);

    // Clear registration
    setClientRegistrations(prev => {
      const next = new Map(prev);
      next.delete(normalizedUrl);

      try {
        localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(Array.from(next.values())));
      } catch (error) {
        console.error('Failed to save client registrations:', error);
      }

      return next;
    });
  }, [clearCredentials]);

  return {
    credentials,
    isAuthenticating,
    getCredentials,
    saveCredentials,
    clearCredentials,
    clearAllForServer,
    getClientRegistration,
    registerClient,
    startOAuth,
    setBearerToken,
  };
}
