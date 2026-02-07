// Secure API key storage via httpOnly cookies
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const COOKIE_NAME = 'mcp-llm-keys';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

interface StoredKeys {
  [provider: string]: { apiKey?: string; baseUrl?: string };
}

function getStoredKeys(request: NextRequest): StoredKeys {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return {};
  try {
    return JSON.parse(atob(cookie.value));
  } catch {
    return {};
  }
}

// GET - check which providers have keys stored (without revealing the keys)
export async function GET(request: NextRequest) {
  const keys = getStoredKeys(request);
  const providers = Object.entries(keys).reduce((acc, [provider, config]) => {
    acc[provider] = { hasKey: !!config.apiKey, hasBaseUrl: !!config.baseUrl };
    return acc;
  }, {} as Record<string, { hasKey: boolean; hasBaseUrl: boolean }>);

  return NextResponse.json({ providers });
}

// POST - store API key for a provider
export async function POST(request: NextRequest) {
  const { provider, apiKey, baseUrl } = await request.json();

  if (!provider) {
    return NextResponse.json({ error: 'Provider required' }, { status: 400 });
  }

  const keys = getStoredKeys(request);
  keys[provider] = { apiKey, baseUrl };

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, btoa(JSON.stringify(keys)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

// DELETE - remove API key for a provider
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  if (!provider) {
    return NextResponse.json({ error: 'Provider required' }, { status: 400 });
  }

  const keys = getStoredKeys(request);
  delete keys[provider];

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, btoa(JSON.stringify(keys)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

// Helper: retrieve the actual API key for a provider (used by other server-side routes)
export function getApiKeyForProvider(request: NextRequest, provider: string): { apiKey?: string; baseUrl?: string } {
  const keys = getStoredKeys(request);
  return keys[provider] || {};
}
