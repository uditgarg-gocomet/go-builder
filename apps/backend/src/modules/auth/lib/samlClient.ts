import * as samlify from 'samlify'
import { db } from '../../../lib/db.js'

const SAML_STATE_TTL_MINUTES = 10

export interface SAMLConfig {
  entityId: string
  // Either metadata XML or individual entryPoint + certificate
  metadata: string | undefined
  entryPoint: string | undefined
  certificate: string | undefined
}

// SP entity ID for this service
function getSpEntityId(): string {
  return process.env['CORE_BACKEND_URL'] ?? 'http://localhost:3001'
}

function buildSAMLCallbackUrl(idpId: string): string {
  const base = process.env['CORE_BACKEND_URL'] ?? 'http://localhost:3001'
  return `${base}/auth/callback/saml/${idpId}`
}

function buildServiceProvider(idpId: string): samlify.ServiceProviderInstance {
  const callbackUrl = buildSAMLCallbackUrl(idpId)
  return samlify.ServiceProvider({
    entityID: getSpEntityId(),
    authnRequestsSigned: false,
    wantAssertionsSigned: false,
    assertionConsumerService: [
      {
        Binding: samlify.Constants.namespace.binding.post,
        Location: callbackUrl,
      },
    ],
  })
}

function buildIdentityProvider(config: SAMLConfig): samlify.IdentityProviderInstance {
  if (config.metadata) {
    return samlify.IdentityProvider({ metadata: config.metadata })
  }

  if (!config.entryPoint || !config.certificate) {
    throw new Error('SAML config requires metadata or entryPoint + certificate')
  }

  return samlify.IdentityProvider({
    entityID: config.entityId,
    singleSignOnService: [
      {
        Binding: samlify.Constants.namespace.binding.redirect,
        Location: config.entryPoint,
      },
    ],
    signingCert: config.certificate,
  })
}

export async function initiateSAMLFlow(
  idpId: string,
  config: SAMLConfig,
  context: 'BUILDER' | 'PORTAL',
  appId: string | undefined,
  environment: 'STAGING' | 'PRODUCTION' | undefined,
  redirectTo: string,
): Promise<{ redirectUrl: string; requestId: string }> {
  const sp = buildServiceProvider(idpId)
  const idp = buildIdentityProvider(config)

  const loginRequest = sp.createLoginRequest(idp, 'redirect') as { context: string; id: string }

  const requestId = loginRequest.id
  const redirectUrl = loginRequest.context

  const expiresAt = new Date(Date.now() + SAML_STATE_TTL_MINUTES * 60 * 1000)

  await db.sAMLState.create({
    data: {
      requestId,
      idpId,
      context,
      appId: appId ?? null,
      environment: environment ?? null,
      redirectTo,
      expiresAt,
    },
  })

  return { redirectUrl, requestId }
}

export async function handleSAMLCallback(
  idpId: string,
  config: SAMLConfig,
  samlResponse: string,
): Promise<{ userId: string; email: string }> {
  const sp = buildServiceProvider(idpId)
  const idp = buildIdentityProvider(config)

  let parsed: { extract: { nameID: string; attributes: Record<string, unknown> } }
  try {
    parsed = await sp.parseLoginResponse(idp, 'post', {
      body: { SAMLResponse: samlResponse },
    }) as typeof parsed
  } catch (err) {
    throw Object.assign(
      new Error('SAML assertion signature invalid or malformed'),
      { statusCode: 401, cause: err }
    )
  }

  const nameID = parsed.extract.nameID
  const attrs = parsed.extract.attributes

  const email =
    (attrs['email'] as string | undefined) ??
    (attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] as string | undefined) ??
    nameID

  return { userId: nameID, email }
}
