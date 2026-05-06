import { Issuer, generators, type BaseClient } from 'openid-client'
import { db } from '../../../lib/db.js'

const OAUTH_STATE_TTL_MINUTES = 10

export interface OIDCConfig {
  issuerUrl: string
  clientId: string
  clientSecret: string
  scopes: string[] | undefined
}

export async function buildOIDCClient(config: OIDCConfig): Promise<BaseClient> {
  const issuer = await Issuer.discover(config.issuerUrl)
  return new issuer.Client({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    response_types: ['code'],
  })
}

export async function initiateOIDCFlow(
  idpId: string,
  config: OIDCConfig,
  context: 'BUILDER' | 'PORTAL',
  appId: string | undefined,
  environment: 'STAGING' | 'PRODUCTION' | undefined,
  redirectTo: string,
): Promise<{ authUrl: string; state: string; codeVerifier: string }> {
  const client = await buildOIDCClient(config)

  const state = generators.state()
  const codeVerifier = generators.codeVerifier()
  const codeChallenge = generators.codeChallenge(codeVerifier)

  const callbackUrl = buildOIDCCallbackUrl(idpId)
  const scopes = config.scopes ?? ['openid', 'email', 'profile']

  const authUrl = client.authorizationUrl({
    redirect_uri: callbackUrl,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000)

  await db.oAuthState.create({
    data: {
      state,
      codeVerifier,
      idpId,
      context,
      appId: appId ?? null,
      environment: environment ?? null,
      redirectTo,
      expiresAt,
    },
  })

  return { authUrl, state, codeVerifier }
}

export async function handleOIDCCallback(
  idpId: string,
  config: OIDCConfig,
  code: string,
  state: string,
): Promise<{ userId: string; email: string }> {
  const oauthState = await db.oAuthState.findUnique({ where: { state } })

  if (!oauthState) {
    throw Object.assign(new Error('Invalid or expired OAuth state'), { statusCode: 400 })
  }

  if (oauthState.expiresAt < new Date()) {
    await db.oAuthState.delete({ where: { state } }).catch(() => null)
    throw Object.assign(new Error('OAuth state expired — restart the login flow'), { statusCode: 400 })
  }

  await db.oAuthState.delete({ where: { state } })

  const client = await buildOIDCClient(config)
  const callbackUrl = buildOIDCCallbackUrl(idpId)

  const tokenSet = await client.callback(callbackUrl, { code, state }, {
    state,
    code_verifier: oauthState.codeVerifier,
  })

  const userinfo = await client.userinfo(tokenSet)

  const email = (userinfo.email ?? userinfo.sub) as string
  const userId = userinfo.sub

  return { userId, email }
}

function buildOIDCCallbackUrl(idpId: string): string {
  const base = process.env['CORE_BACKEND_URL'] ?? 'http://localhost:3001'
  return `${base}/auth/callback/oidc/${idpId}`
}
