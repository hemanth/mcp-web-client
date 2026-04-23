// LLM Connection Test API Route
import { NextRequest } from 'next/server';
import type { LLMProvider } from '@/lib/llm-types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const LLM_KEYS_COOKIE = 'mcp-llm-keys';

function getApiKeyFromCookie(request: NextRequest, provider: string): { apiKey?: string; baseUrl?: string } {
  const cookie = request.cookies.get(LLM_KEYS_COOKIE);
  if (!cookie?.value) return {};
  try {
    const keys = JSON.parse(atob(cookie.value));
    return keys[provider] || {};
  } catch {
    return {};
  }
}

interface TestRequest {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
}

async function testOpenAI(apiKey: string): Promise<boolean> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  return response.ok;
}

async function testAnthropic(apiKey: string): Promise<boolean> {
  // Anthropic doesn't have a simple test endpoint, so we make a minimal request
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });
  // 200 = success, 400 = bad request but API key works
  return response.ok || response.status === 400;
}

async function testGemini(apiKey: string): Promise<boolean> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  return response.ok;
}

async function testOllama(baseUrl: string): Promise<boolean> {
  const response = await fetch(`${baseUrl}/api/tags`);
  return response.ok;
}

async function testOpenAICompatible(
  baseUrl: string,
  apiKey?: string,
  customHeaders?: Record<string, string>
): Promise<boolean> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  if (customHeaders) {
    for (const [key, value] of Object.entries(customHeaders)) {
      if (key && value) {
        headers[key] = value;
      }
    }
  }

  // Try /models first, fall back to a minimal chat completion
  const url = baseUrl.replace(/\/$/, '');
  const modelsUrl = url.endsWith('/v1') ? `${url}/models` : `${url}/v1/models`;

  try {
    const response = await fetch(modelsUrl, { headers });
    if (response.ok) return true;
  } catch {
    // /models not available, try a minimal completion
  }

  // Fall back: attempt a tiny chat request
  try {
    const chatUrl = url.endsWith('/v1')
      ? `${url}/chat/completions`
      : `${url}/v1/chat/completions`;

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    });
    // Any non-network-error response means the endpoint is reachable
    return response.ok || response.status === 400 || response.status === 401 || response.status === 404;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TestRequest;
    const { provider } = body;

    // Resolve API key from cookie if not in body
    const cookieKeys = getApiKeyFromCookie(request, provider);
    const apiKey = body.apiKey || cookieKeys.apiKey;
    const baseUrl = body.baseUrl || cookieKeys.baseUrl;

    let success = false;

    switch (provider) {
      case 'openai':
        if (!apiKey) throw new Error('API key required');
        success = await testOpenAI(apiKey);
        break;
      case 'anthropic':
        if (!apiKey) throw new Error('API key required');
        success = await testAnthropic(apiKey);
        break;
      case 'gemini':
        if (!apiKey) throw new Error('API key required');
        success = await testGemini(apiKey);
        break;
      case 'ollama':
        success = await testOllama(baseUrl || 'http://localhost:11434');
        break;
      case 'nvidia':
      case 'custom': {
        const bUrl = baseUrl || (provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : '');
        if (!bUrl) throw new Error('Base URL required');
        success = await testOpenAICompatible(bUrl, apiKey, body.customHeaders);
        break;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    if (success) {
      return Response.json({ success: true });
    } else {
      return Response.json({ error: 'Connection failed' }, { status: 400 });
    }
  } catch (error) {
    console.error('LLM test error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
