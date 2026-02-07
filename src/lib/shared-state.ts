// Server-side shared state for OAuth flow
// NOTE: In edge/serverless environments, in-memory state is ephemeral.
// Cookie-based persistence in connect/route.ts and callback/route.ts
// is the primary storage mechanism. This in-memory store serves as a
// fast-path cache within the same isolate only.

interface OAuthState {
  serverUrl: string;
  codeVerifier?: string;
  clientId?: string;
  clientSecret?: string;
  createdAt: number;
}

interface ClientRegistration {
  clientId: string;
  clientSecret?: string;
  registrationAccessToken?: string;
  serverUrl: string;
}

// In-memory cache (fast-path only, not durable across isolates)
const oauthStates = new Map<string, OAuthState>();
const clientRegistrations = new Map<string, ClientRegistration>();

// State TTL: 10 minutes
const STATE_TTL = 10 * 60 * 1000;

// Cleanup expired states periodically
function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > STATE_TTL) {
      oauthStates.delete(state);
    }
  }
}

// Run cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredStates, 60000);
}

export function setOAuthState(state: string, data: Omit<OAuthState, 'createdAt'>) {
  oauthStates.set(state, { ...data, createdAt: Date.now() });
}

export function getOAuthState(state: string): OAuthState | undefined {
  const data = oauthStates.get(state);
  if (data && Date.now() - data.createdAt <= STATE_TTL) {
    return data;
  }
  oauthStates.delete(state);
  return undefined;
}

export function deleteOAuthState(state: string) {
  oauthStates.delete(state);
}

export function setClientRegistration(serverUrl: string, registration: ClientRegistration) {
  clientRegistrations.set(serverUrl, registration);
}

export function getClientRegistration(serverUrl: string): ClientRegistration | undefined {
  return clientRegistrations.get(serverUrl);
}

export function deleteClientRegistration(serverUrl: string) {
  clientRegistrations.delete(serverUrl);
}
