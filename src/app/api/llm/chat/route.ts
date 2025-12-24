// Unified LLM Chat API Route
import { NextRequest } from 'next/server';
import type { LLMProvider, ChatMessage, MCPToolDefinition, ToolCall } from '@/lib/llm-types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface ChatRequest {
  provider: LLMProvider;
  model: string;
  messages: ChatMessage[];
  tools?: MCPToolDefinition[];
  stream?: boolean;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
}

// Convert our messages to provider-specific format
function convertMessagesForOpenAI(messages: ChatMessage[], systemPrompt?: string) {
  const result: Array<{
    role: string;
    content: string | null;
    tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
    tool_call_id?: string;
  }> = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      result.push({
        role: 'tool',
        content: msg.content,
        tool_call_id: msg.toolCallId,
      });
    } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      result.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      });
    } else {
      result.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return result;
}

function convertToolsForOpenAI(tools?: MCPToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;

  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema,
    },
  }));
}

function convertMessagesForAnthropic(messages: ChatMessage[], systemPrompt?: string) {
  const result: Array<{
    role: string;
    content: string | Array<{ type: string; tool_use_id?: string; content?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
  }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue; // System handled separately

    // Skip messages with empty content (except tool messages and messages with tool calls)
    if (!msg.content && msg.role !== 'tool' && (!msg.toolCalls || msg.toolCalls.length === 0)) {
      continue;
    }

    if (msg.role === 'tool') {
      // Anthropic expects tool results in user messages
      result.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.toolCallId || '',
          content: msg.content,
        }],
      });
    } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      const content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      result.push({ role: 'assistant', content });
    } else {
      result.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return { messages: result, system: systemPrompt };
}

function convertToolsForAnthropic(tools?: MCPToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;

  return tools.map(tool => ({
    name: tool.name,
    description: tool.description || '',
    input_schema: tool.inputSchema,
  }));
}

function convertMessagesForGemini(messages: ChatMessage[], systemPrompt?: string) {
  const contents: Array<{
    role: string;
    parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } }>;
  }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'tool') {
      // Find the corresponding tool call to get the function name
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: msg.toolCallId || 'unknown',
            response: JSON.parse(msg.content || '{}'),
          },
        }],
      });
    } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      const parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        parts.push({
          functionCall: {
            name: tc.name,
            args: tc.arguments,
          },
        });
      }
      contents.push({ role: 'model', parts });
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  return { contents, systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined };
}

function convertToolsForGemini(tools?: MCPToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;

  return [{
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema,
    })),
  }];
}

function convertMessagesForOllama(messages: ChatMessage[], systemPrompt?: string) {
  const result: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      result.push({
        role: 'user',
        content: `Tool result: ${msg.content}`,
      });
    } else {
      result.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return result;
}

// Parse tool calls from different provider responses
function parseOpenAIToolCalls(response: {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
    }
  }>
}): { content: string; toolCalls: ToolCall[] } {
  const message = response.choices[0]?.message;
  const toolCalls: ToolCall[] = [];

  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
        status: 'pending',
      });
    }
  }

  return {
    content: message?.content || '',
    toolCalls,
  };
}

function parseAnthropicToolCalls(response: {
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>
}): { content: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];
  let content = '';

  for (const block of response.content) {
    if (block.type === 'text') {
      content += block.text || '';
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id || '',
        name: block.name || '',
        arguments: block.input || {},
        status: 'pending',
      });
    }
  }

  return { content, toolCalls };
}

function parseGeminiToolCalls(response: {
  candidates: Array<{
    content: {
      parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>
    }
  }>
}): { content: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];
  let content = '';

  const parts = response.candidates[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.text) {
      content += part.text;
    } else if (part.functionCall) {
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args,
        status: 'pending',
      });
    }
  }

  return { content, toolCalls };
}

async function callOpenAI(request: ChatRequest): Promise<Response> {
  const messages = convertMessagesForOpenAI(request.messages, request.systemPrompt);
  const tools = convertToolsForOpenAI(request.tools);

  const body: Record<string, unknown> = {
    model: request.model,
    messages,
    stream: request.stream,
  };

  if (tools) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  if (request.stream) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  const data = await response.json();
  const { content, toolCalls } = parseOpenAIToolCalls(data);

  return Response.json({
    message: {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    },
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  });
}

async function callAnthropic(request: ChatRequest): Promise<Response> {
  const { messages, system } = convertMessagesForAnthropic(request.messages, request.systemPrompt);
  const tools = convertToolsForAnthropic(request.tools);

  const body: Record<string, unknown> = {
    model: request.model,
    messages,
    max_tokens: 4096,
    stream: request.stream,
  };

  if (system) {
    body.system = system;
  }

  if (tools) {
    body.tools = tools;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': request.apiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  if (request.stream) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  const data = await response.json();
  const { content, toolCalls } = parseAnthropicToolCalls(data);

  return Response.json({
    message: {
      id: data.id || `msg_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    },
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    } : undefined,
  });
}

async function callGemini(request: ChatRequest): Promise<Response> {
  const { contents, systemInstruction } = convertMessagesForGemini(request.messages, request.systemPrompt);
  const tools = convertToolsForGemini(request.tools);

  const body: Record<string, unknown> = {
    contents,
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  if (tools) {
    body.tools = tools;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${request.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const { content, toolCalls } = parseGeminiToolCalls(data);

  return Response.json({
    message: {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    },
    usage: data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount,
      completionTokens: data.usageMetadata.candidatesTokenCount,
      totalTokens: data.usageMetadata.totalTokenCount,
    } : undefined,
  });
}

async function callOllama(request: ChatRequest): Promise<Response> {
  const messages = convertMessagesForOllama(request.messages, request.systemPrompt);
  const baseUrl = request.baseUrl || 'http://localhost:11434';

  const body: Record<string, unknown> = {
    model: request.model,
    messages,
    stream: request.stream,
  };

  // Ollama has limited tool support, include tool descriptions in system prompt
  if (request.tools && request.tools.length > 0) {
    const toolsDesc = request.tools.map(t =>
      `- ${t.name}: ${t.description || 'No description'}`
    ).join('\n');

    if (messages[0]?.role === 'system') {
      messages[0].content += `\n\nAvailable tools:\n${toolsDesc}`;
    } else {
      messages.unshift({
        role: 'system',
        content: `You have access to the following tools:\n${toolsDesc}`,
      });
    }
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${error}`);
  }

  if (request.stream) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  const data = await response.json();

  return Response.json({
    message: {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: data.message?.content || '',
      timestamp: Date.now(),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ChatRequest;
    const { provider } = body;

    switch (provider) {
      case 'openai':
        return await callOpenAI(body);
      case 'anthropic':
        return await callAnthropic(body);
      case 'gemini':
        return await callGemini(body);
      case 'ollama':
        return await callOllama(body);
      default:
        return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }
  } catch (error) {
    console.error('LLM API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
