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

    // Normalize server URL - remove /sse suffix if present
    const baseUrl = serverUrl.replace(/\/sse$/, '');
    const callbackUri = redirectUri || `${request.nextUrl.origin}/auth/callback`;

    // First try OAuth discovery
    const metadata = await discoverOAuthMetadata(baseUrl);

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
