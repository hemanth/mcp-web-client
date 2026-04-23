// Fetch live model lists from LLM providers
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
  const data = await res.json();
  return (data.data || [])
    .filter((m: { id: string }) => 
      m.id.startsWith('gpt-') || m.id.startsWith('o') || m.id.startsWith('chatgpt-')
    )
    .map((m: { id: string }) => ({
      id: m.id,
      name: m.id,
    }))
    .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
}

async function fetchNvidiaModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
  const url = baseUrl || 'https://integrate.api.nvidia.com/v1';
  const res = await fetch(`${url}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`NVIDIA: ${res.status}`);
  const data = await res.json();
  return (data.data || [])
    .map((m: { id: string }) => ({
      id: m.id,
      name: m.id.split('/').pop() || m.id,
    }))
    .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
}

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) throw new Error(`Gemini: ${res.status}`);
  const data = await res.json();
  return (data.models || [])
    .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent')
    )
    .map((m: { name: string; displayName: string; inputTokenLimit?: number }) => ({
      id: m.name.replace('models/', ''),
      name: m.displayName || m.name.replace('models/', ''),
      contextWindow: m.inputTokenLimit,
    }));
}

async function fetchOllamaModels(baseUrl?: string): Promise<ModelInfo[]> {
  const url = baseUrl || 'http://localhost:11434';
  const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Ollama: ${res.status}`);
  const data = await res.json();
  return (data.models || [])
    .map((m: { name: string }) => ({
      id: m.name,
      name: m.name,
    }));
}

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, baseUrl } = await request.json();

    let models: ModelInfo[] = [];

    switch (provider) {
      case 'openai':
        if (!apiKey) return NextResponse.json({ error: 'API key required' }, { status: 400 });
        models = await fetchOpenAIModels(apiKey);
        break;
      case 'nvidia':
        if (!apiKey) return NextResponse.json({ error: 'API key required' }, { status: 400 });
        models = await fetchNvidiaModels(apiKey, baseUrl);
        break;
      case 'gemini':
        if (!apiKey) return NextResponse.json({ error: 'API key required' }, { status: 400 });
        models = await fetchGeminiModels(apiKey);
        break;
      case 'ollama':
        models = await fetchOllamaModels(baseUrl);
        break;
      case 'anthropic':
        // Anthropic doesn't have a public models listing API
        return NextResponse.json({ error: 'Anthropic does not provide a models endpoint' }, { status: 400 });
      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
