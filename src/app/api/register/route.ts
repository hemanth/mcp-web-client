// Dynamic Client Registration endpoint
import { NextRequest, NextResponse } from 'next/server';
import { discoverOAuthMetadata, registerClient } from '@/lib/oauth';
import { setClientRegistration } from '@/lib/shared-state';

export async function POST(request: NextRequest) {
  try {
    const { serverUrl, redirectUri } = await request.json();

    if (!serverUrl) {
      return NextResponse.json({ error: 'serverUrl is required' }, { status: 400 });
    }

    // Normalize server URL - remove /sse or /mcp suffix if present
    let baseUrl = serverUrl.replace(/\/(sse|mcp)\/?$/, '');

    // For URLs ending in /mcp, try OAuth discovery at the domain root
    const urlObj = new URL(serverUrl);
    const isHttpStreamable = serverUrl.includes('/mcp');

    console.log(`Register request - serverUrl: ${serverUrl}, baseUrl: ${baseUrl}, isHttpStreamable: ${isHttpStreamable}`);

    const callbackUri = redirectUri || `${request.nextUrl.origin}/auth/callback`;

    // First try OAuth discovery at the base URL
    let metadata = await discoverOAuthMetadata(baseUrl);
    console.log(`OAuth discovery at ${baseUrl}: ${metadata ? 'found' : 'not found'}`);

    // If not found and it's an HTTP Streamable endpoint, try the domain root
    if (!metadata && isHttpStreamable) {
      const domainRoot = `${urlObj.protocol}//${urlObj.host}`;
      console.log(`OAuth discovery failed at ${baseUrl}, trying domain root: ${domainRoot}`);
      metadata = await discoverOAuthMetadata(domainRoot);
      if (metadata) {
        baseUrl = domainRoot;
      }
    }

    if (metadata?.registration_endpoint) {
      // Use discovered registration endpoint
      const registration = await registerClient(metadata.registration_endpoint, {
        redirect_uris: [callbackUri],
        client_name: 'MCP Web Client',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_basic',
        scope: metadata.scopes_supported?.join(' ') || 'openid profile email',
      });

      setClientRegistration(baseUrl, {
        clientId: registration.client_id,
        clientSecret: registration.client_secret,
        registrationAccessToken: registration.registration_access_token,
        serverUrl: baseUrl,
      });

      return NextResponse.json({
        success: true,
        clientId: registration.client_id,
        clientSecret: registration.client_secret,
        metadata,
      });
    }

    // For HTTP Streamable endpoints without OAuth discovery,
    // return info that OAuth redirect is needed
    if (isHttpStreamable && !metadata) {
      console.log(`HTTP Streamable endpoint ${serverUrl} requires OAuth - redirecting to server`);
      // Return a special response indicating the user needs to authenticate directly
      return NextResponse.json({
        success: true,
        requiresDirectAuth: true,
        authUrl: serverUrl,
        message: 'This server requires direct authentication. You will be redirected to authenticate.',
      });
    }

    // Fallback: Try direct /register endpoint (PayPal MCP style)
    const registrationEndpoint = `${baseUrl}/register`;
    console.log(`Attempting direct registration at: ${registrationEndpoint}`);

    const registrationRequest = {
      client_name: 'MCP Web Client',
      application_type: 'web',
      redirect_uris: [callbackUri],
      token_endpoint_auth_method: 'client_secret_basic',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      software_id: 'mcp-web-client',
      software_version: '1.0.0',
    };

    const response = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Registration failed:', response.status, errorText);
      return NextResponse.json(
        { error: `Registration failed: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Store registration for later use
    setClientRegistration(baseUrl, {
      clientId: data.client_id,
      clientSecret: data.client_secret,
      registrationAccessToken: data.registration_access_token,
      serverUrl: baseUrl,
    });

    return NextResponse.json({
      success: true,
      clientId: data.client_id,
      clientSecret: data.client_secret,
    });
  } catch (error) {
    console.error('Client registration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration failed' },
      { status: 500 }
    );
  }
}
