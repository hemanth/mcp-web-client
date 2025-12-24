// LLM Connection Test API Route
import { NextRequest } from 'next/server';
import type { LLMProvider } from '@/lib/llm-types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface TestRequest {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TestRequest;
    const { provider, apiKey, baseUrl } = body;

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
