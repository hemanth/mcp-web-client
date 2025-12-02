// OAuth Authorization initiation endpoint
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { discoverOAuthMetadata, generatePKCE, buildAuthorizationUrl, generateState } from '@/lib/oauth';
import { setOAuthState, getClientRegistration } from '@/lib/shared-state';

export async function POST(request: NextRequest) {
  try {
    const { serverUrl, clientId, clientSecret, scope } = await request.json();

    if (!serverUrl) {
      return NextResponse.json({ error: 'serverUrl is required' }, { status: 400 });
    }

    // Normalize server URL - remove /sse or /mcp suffix if present
    const baseUrl = serverUrl.replace(/\/(sse|mcp)\/?$/, '');

    // Get client registration (from dynamic registration or provided)
    let effectiveClientId = clientId;
    let effectiveClientSecret = clientSecret;

    if (!effectiveClientId) {
      const registration = getClientRegistration(baseUrl);
      if (registration) {
        effectiveClientId = registration.clientId;
        effectiveClientSecret = registration.clientSecret;
      } else {
        return NextResponse.json(
          { error: 'No client registration found. Please register first.' },
          { status: 400 }
        );
      }
    }

    // Try to discover OAuth metadata
    const metadata = await discoverOAuthMetadata(baseUrl);

    // Generate state for CSRF protection
    const state = generateState();

    const redirectUri = `${request.nextUrl.origin}/auth/callback`;
    // PayPal MCP doesn't define scopes_supported, try without specifying scope
    // or use a minimal scope if one is provided
    const effectiveScope = scope || metadata?.scopes_supported?.join(' ') || '';
    console.log('Using scope:', effectiveScope || '(none)');

    let authUrl: string;
    let codeVerifier: string | undefined;

    if (metadata?.authorization_endpoint) {
      // Use discovered endpoints
      const supportsPKCE = metadata.code_challenge_methods_supported?.includes('S256');
      const pkce = supportsPKCE ? await generatePKCE() : undefined;
      codeVerifier = pkce?.codeVerifier;

      authUrl = buildAuthorizationUrl({
        authorizationEndpoint: metadata.authorization_endpoint,
        clientId: effectiveClientId,
        redirectUri,
        scope: effectiveScope,
        state,
        codeChallenge: pkce?.codeChallenge,
        codeChallengeMethod: supportsPKCE ? 'S256' : undefined,
      });
    } else {
      // Fallback to PayPal MCP style: direct /authorize endpoint
      const authEndpoint = new URL(`${baseUrl}/authorize`);
      authEndpoint.searchParams.set('response_type', 'code');
      authEndpoint.searchParams.set('client_id', effectiveClientId);
      authEndpoint.searchParams.set('redirect_uri', redirectUri);
      authEndpoint.searchParams.set('state', state);
      if (effectiveScope) {
        authEndpoint.searchParams.set('scope', effectiveScope);
      }
      authUrl = authEndpoint.toString();
    }

    // Store state with server info and client credentials
    const oauthStateData = {
      serverUrl: baseUrl,
      codeVerifier,
      clientId: effectiveClientId,
      clientSecret: effectiveClientSecret,
    };
    setOAuthState(state, oauthStateData);

    console.log(`Generated auth URL: ${authUrl}`);
    console.log(`Redirect URI: ${redirectUri}`);

    // Also store state in a cookie for persistence across server restarts
    const cookieStore = await cookies();
    cookieStore.set(`oauth_state_${state}`, JSON.stringify(oauthStateData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return NextResponse.json({
      requiresAuth: true,
      authUrl,
      state,
      clientId: effectiveClientId,
      clientSecret: effectiveClientSecret,
      metadata,
    });
  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      { status: 500 }
    );
  }
}
