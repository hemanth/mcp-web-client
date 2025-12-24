// SSE proxy for MCP server
import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const serverUrl = request.headers.get('x-mcp-server-url');
  const authorization = request.headers.get('authorization');
  const customHeadersJson = request.headers.get('x-mcp-custom-headers');

  if (!serverUrl) {
    return new Response('Missing x-mcp-server-url header', { status: 400 });
  }

  try {
    // Connect to MCP server SSE endpoint
    // Normalize: remove trailing /sse if present, then add it back
    const baseUrl = serverUrl.replace(/\/sse\/?$/, '');
    const sseUrl = `${baseUrl}/sse`;

    console.log('SSE proxy connecting to:', sseUrl);
    console.log('Authorization header:', authorization ? `${authorization.substring(0, 50)}...` : 'none');

    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    };

    if (authorization) {
      // Normalize token type to 'Bearer' (capitalized) as per RFC 6750
      // PayPal OAuth returns token_type: "bearer" (lowercase) but requires "Bearer" (capitalized)
      const normalizedAuth = authorization.replace(/^bearer\s+/i, 'Bearer ');
      headers['Authorization'] = normalizedAuth;
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

    const response = await fetch(sseUrl, {
      headers,
      // @ts-expect-error - duplex is needed for streaming
      duplex: 'half',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`MCP server error: ${response.status} - ${errorText}`, {
        status: response.status,
      });
    }

    if (!response.body) {
      return new Response('No response body from MCP server', { status: 500 });
    }

    // Create a TransformStream to forward the SSE data
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Forward SSE events
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          await writer.write(new TextEncoder().encode(chunk));
        }
      } catch (error) {
        console.error('SSE proxy error:', error);
      } finally {
        try {
          await writer.close();
        } catch {
          // Stream may already be closed, ignore
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('SSE proxy error:', error);
    return new Response(
      `Failed to connect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    );
  }
}
