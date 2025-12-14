// Streamable HTTP proxy for MCP server
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const serverUrl = request.headers.get('x-mcp-server-url');
  const authorization = request.headers.get('authorization');
  const sessionId = request.headers.get('x-mcp-session-id');
  const customHeadersJson = request.headers.get('x-mcp-custom-headers');

  if (!serverUrl) {
    return new Response('Missing x-mcp-server-url header', { status: 400 });
  }

  try {
    const body = await request.json();

    console.log('Streamable HTTP proxy sending to:', serverUrl);
    console.log('Request body:', JSON.stringify(body));
    console.log('Incoming session ID from client:', sessionId);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    if (authorization) {
      const normalizedAuth = authorization.replace(/^bearer\s+/i, 'Bearer ');
      headers['Authorization'] = normalizedAuth;
    }

    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
      console.log('Forwarding session ID to MCP server:', sessionId);
    }

    // Parse and apply custom headers
    if (customHeadersJson) {
      try {
        const customHeaders = JSON.parse(customHeadersJson) as Record<string, string>;
        for (const [key, value] of Object.entries(customHeaders)) {
          // Skip headers that could interfere with the proxy
          const lowerKey = key.toLowerCase();
          if (lowerKey !== 'host' && lowerKey !== 'content-length' && lowerKey !== 'transfer-encoding') {
            headers[key] = value;
          }
        }
        console.log('Custom headers applied:', Object.keys(customHeaders).join(', '));
      } catch (e) {
        console.error('Failed to parse custom headers:', e);
      }
    }

    const response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    console.log('Response status:', response.status);
    console.log('Response content-type:', response.headers.get('content-type'));

    // Get session ID from response if present
    const responseSessionId = response.headers.get('mcp-session-id');
    console.log('Response session ID from MCP server:', responseSessionId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Streamable HTTP error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `MCP server error: ${response.status} - ${errorText}` }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const contentType = response.headers.get('content-type') || '';

    // If response is SSE, stream it back
    if (contentType.includes('text/event-stream')) {
      if (!response.body) {
        return new Response('No response body', { status: 500 });
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            await writer.write(new TextEncoder().encode(chunk));
          }
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          try {
            await writer.close();
          } catch {
            // Ignore
          }
        }
      })();

      const responseHeaders: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      };

      if (responseSessionId) {
        responseHeaders['Mcp-Session-Id'] = responseSessionId;
      }

      return new Response(readable, { headers: responseHeaders });
    }

    // If response is JSON, return it directly
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const responseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (responseSessionId) {
        responseHeaders['Mcp-Session-Id'] = responseSessionId;
      }
      return new Response(JSON.stringify(data), { headers: responseHeaders });
    }

    // For 202 Accepted with no content
    if (response.status === 202) {
      const responseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (responseSessionId) {
        responseHeaders['Mcp-Session-Id'] = responseSessionId;
      }
      return new Response(JSON.stringify({ success: true }), { headers: responseHeaders });
    }

    // Fallback
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (error) {
    console.error('Streamable HTTP proxy error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
