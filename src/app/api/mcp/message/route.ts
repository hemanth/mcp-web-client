// Message proxy for MCP server
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const serverUrl = request.headers.get('x-mcp-server-url');
  const authorization = request.headers.get('authorization');
  const sessionId = request.headers.get('x-mcp-session-id');

  if (!serverUrl) {
    return NextResponse.json(
      { error: 'Missing x-mcp-server-url header' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    let messageUrl: string;

    // Check if serverUrl is already a full message endpoint URL
    if (serverUrl.includes('/message')) {
      // It's already the full endpoint URL
      messageUrl = serverUrl;
    } else {
      // Normalize server URL and construct message endpoint
      const baseUrl = serverUrl.replace(/\/sse\/?$/, '');
      messageUrl = `${baseUrl}/sse/message`;
    }

    console.log('Message proxy sending to:', messageUrl);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authorization) {
      // Normalize token type to 'Bearer' (capitalized) as per RFC 6750
      // PayPal OAuth returns token_type: "bearer" (lowercase) but requires "Bearer" (capitalized)
      const normalizedAuth = authorization.replace(/^bearer\s+/i, 'Bearer ');
      headers['Authorization'] = normalizedAuth;
    }

    if (sessionId) {
      headers['X-MCP-Session-ID'] = sessionId;
    }

    console.log('Message body:', JSON.stringify(body));

    let response = await fetch(messageUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    console.log('Message response status:', response.status);

    // If fails with 404 and we haven't tried /message yet, try that
    if (response.status === 404 && !messageUrl.endsWith('/message')) {
      // Extract base URL and try /message
      const baseUrl = serverUrl.replace(/\/sse\/?$/, '').replace(/\/message$/, '');
      messageUrl = `${baseUrl}/message`;
      console.log('Retrying with:', messageUrl);
      response = await fetch(messageUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      console.log('Retry response status:', response.status);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Message error:', response.status, errorText);
      return NextResponse.json(
        { error: `MCP server error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // Some servers return 202 Accepted with no body for async processing
    return NextResponse.json({ success: true, status: response.status });
  } catch (error) {
    console.error('Message proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Message send failed' },
      { status: 500 }
    );
  }
}
