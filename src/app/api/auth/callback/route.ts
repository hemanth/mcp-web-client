export const runtime = "edge";

// OAuth callback handler
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { discoverOAuthMetadata, exchangeCodeForTokens } from '@/lib/oauth';
import { getOAuthState, deleteOAuthState, getClientRegistration } from '@/lib/shared-state';

interface OAuthStateData {
  serverUrl: string;
  codeVerifier?: string;
  clientId?: string;
  clientSecret?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      return NextResponse.json(
        { error, description: errorDescription },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 }
      );
    }

    // Validate state - try in-memory first, then cookie fallback
    let oauthState = getOAuthState(state);
    console.log('Callback received state:', state);
    console.log('OAuth state found in memory:', !!oauthState);

    // If not found in memory, try to get from cookie
    if (!oauthState) {
      const cookieStore = await cookies();
      const stateCookie = cookieStore.get(`oauth_state_${state}`);
      if (stateCookie) {
        try {
          const cookieData = JSON.parse(stateCookie.value) as OAuthStateData;
          oauthState = {
            ...cookieData,
            createdAt: Date.now(),
          };
          console.log('OAuth state recovered from cookie for server:', cookieData.serverUrl);
          // Delete the cookie after reading
          cookieStore.delete(`oauth_state_${state}`);
        } catch (e) {
          console.error('Failed to parse OAuth state cookie:', e);
        }
      }
    }

    if (!oauthState) {
      console.error('OAuth state not found for state:', state);
      return NextResponse.json(
        { error: 'Invalid or expired state parameter. This can happen if the server restarted during the OAuth flow.' },
        { status: 400 }
      );
    }

    // Get client credentials from state or registration
    let clientId = oauthState.clientId;
    let clientSecret = oauthState.clientSecret;

    if (!clientId) {
      const registration = getClientRegistration(oauthState.serverUrl);
      if (registration) {
        clientId = registration.clientId;
        clientSecret = registration.clientSecret;
      }
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'No client credentials found' },
        { status: 400 }
      );
    }

    // Try to discover OAuth metadata for token endpoint
    const metadata = await discoverOAuthMetadata(oauthState.serverUrl);

    // Use discovered token endpoint or fallback to /token
    const tokenEndpoint = metadata?.token_endpoint || `${oauthState.serverUrl}/token`;

    // Exchange code for tokens
    const redirectUri = `${request.nextUrl.origin}/auth/callback`;
    const tokens = await exchangeCodeForTokens({
      tokenEndpoint,
      code,
      redirectUri,
      clientId,
      clientSecret,
      codeVerifier: oauthState.codeVerifier,
    });

    // Clean up state
    deleteOAuthState(state);

    // Calculate expiry time
    const expiresAt = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined;

    console.log('Token exchange successful:');
    console.log('  access_token preview:', tokens.access_token?.substring(0, 30) + '...');
    console.log('  token_type:', tokens.token_type);
    console.log('  scope:', tokens.scope);
    console.log('  expires_in:', tokens.expires_in);
    console.log('  full token response:', JSON.stringify(tokens, null, 2));

    // Return tokens as JSON (the callback page will handle storage)
    return NextResponse.json({
      success: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresAt,
      scope: tokens.scope,
      serverUrl: oauthState.serverUrl,
    });
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token exchange failed' },
      { status: 500 }
    );
  }
}
