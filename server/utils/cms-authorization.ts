import { createError, getHeader, getRequestURL, type H3Event } from 'h3'

import type { CmsUserAuthorization } from '../../shared/types/cms'
import { findCmsUserByDiscordId, getCmsUserAuthorization } from './cms/repository'

export type CmsRole = CmsUserAuthorization['role']

export interface AuthorizedCmsUser {
  id: string
  discordId: string
  username: string
  displayName: string | null
  avatarHash: string | null
  role: CmsRole
}

export interface AuthenticatedDiscordUser {
  discordId: string
  username: string
  displayName: string | null
}

const ROLE_RANK: Record<CmsRole, number> = {
  editor: 1,
  admin: 2,
  super_admin: 3,
}

const DISCORD_SNOWFLAKE_PATTERN = /^\d{17,20}$/
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function getConfiguredSuperAdminDiscordId(event: H3Event) {
  const configuredId = String(useRuntimeConfig(event).cmsSuperAdminDiscordId || '').trim()

  return DISCORD_SNOWFLAKE_PATTERN.test(configuredId) ? configuredId : ''
}

export function isConfiguredCmsSuperAdmin(event: H3Event, discordId: string) {
  const configuredId = getConfiguredSuperAdminDiscordId(event)

  return Boolean(configuredId && discordId === configuredId)
}

/** Assertion privée pour le bridge signé ; jamais issue de la query ou du navigateur. */
export function isActiveCmsAdministrator(event: H3Event, discordId: string): boolean {
  if (isConfiguredCmsSuperAdmin(event, discordId)) return true

  const profile = findCmsUserByDiscordId(discordId)
  if (!profile?.isActive) return false
  const authorization = getCmsUserAuthorization(profile.id)
  if (!authorization?.isActive || authorization.discordId !== discordId) return false

  // Une ancienne valeur « super_admin » en base n’accorde jamais un privilège.
  return resolveCmsRole(event, authorization) === 'admin'
}

function resolveCmsRole(event: H3Event, authorization: CmsUserAuthorization): CmsRole | null {
  if (isConfiguredCmsSuperAdmin(event, authorization.discordId)) {
    return 'super_admin'
  }

  // A database value alone must never grant the highest privilege.
  if (authorization.role === 'super_admin') {
    return null
  }

  return authorization.role
}

async function clearInvalidUserSession(event: H3Event): Promise<never> {
  await clearUserSession(event)

  throw createError({
    statusCode: 401,
    statusMessage: 'Unauthorized',
  })
}

export async function requireAuthenticatedDiscordUser(
  event: H3Event,
): Promise<AuthenticatedDiscordUser> {
  const session = await requireUserSession(event)
  const discordId = typeof session.user.discordId === 'string' ? session.user.discordId.trim() : ''
  const username = typeof session.user.username === 'string' ? session.user.username.trim() : ''
  const displayName =
    typeof session.user.displayName === 'string' && session.user.displayName.trim()
      ? session.user.displayName.trim()
      : null
  if (!DISCORD_SNOWFLAKE_PATTERN.test(discordId) || !username || username.length > 80) {
    return clearInvalidUserSession(event)
  }

  return {
    discordId,
    username,
    displayName,
  }
}

export async function requireCmsUser(event: H3Event): Promise<AuthorizedCmsUser> {
  const principal = await requireAuthenticatedDiscordUser(event)
  const profile = findCmsUserByDiscordId(principal.discordId)

  if (!profile?.isActive) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  const authorization = getCmsUserAuthorization(profile.id)

  if (!authorization?.isActive || authorization.discordId !== principal.discordId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  const role = resolveCmsRole(event, authorization)

  if (!role) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  return {
    id: authorization.id,
    discordId: authorization.discordId,
    username: profile.username,
    displayName: profile.displayName,
    avatarHash: profile.avatarHash,
    role,
  }
}

export async function requireCmsRole(
  event: H3Event,
  minimumRole: CmsRole,
): Promise<AuthorizedCmsUser> {
  const user = await requireCmsUser(event)

  if (ROLE_RANK[user.role] < ROLE_RANK[minimumRole]) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  return user
}

/**
 * Refuse les mutations CMS provenant d'une autre origine. Les handlers de
 * lecture peuvent appeler ce helper sans effet.
 */
export function assertCmsMutationOrigin(event: H3Event) {
  if (SAFE_METHODS.has(event.method.toUpperCase())) return

  const requestOrigin = getRequestURL(event).origin
  const configuredSiteUrl = String(useRuntimeConfig(event).public.siteUrl || '')
  const allowedOrigins = new Set<string>()

  if (configuredSiteUrl) {
    try {
      allowedOrigins.add(new URL(configuredSiteUrl).origin)
    } catch {
      // A malformed optional public URL must not weaken the origin check.
    }
  }

  if (allowedOrigins.size === 0) {
    allowedOrigins.add(requestOrigin)
  }

  const origin = getHeader(event, 'origin')
  let normalizedOrigin = ''

  if (origin) {
    try {
      normalizedOrigin = new URL(origin).origin
    } catch {
      // The empty normalized value will be rejected below.
    }
  }

  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}

export async function requireCmsMutationRole(event: H3Event, minimumRole: CmsRole) {
  assertCmsMutationOrigin(event)

  return requireCmsRole(event, minimumRole)
}
