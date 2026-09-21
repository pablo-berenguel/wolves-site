import {
  deleteCookie,
  getCookie,
  getQuery,
  getRequestURL,
  sendRedirect,
  setCookie,
  setHeader,
  type H3Event,
} from 'h3'

import type { CmsDiscordProfileInput, CmsUser } from '../../../shared/types/cms'
import {
  findCmsUserByDiscordId,
  updateCmsUserDiscordProfile,
  upsertCmsUser,
} from '../../utils/cms/repository'
import { isConfiguredCmsSuperAdmin } from '../../utils/cms-authorization'
import {
  getMemberParticipationAccess,
  getSelfRegistration,
  getTrainingAnnouncementAccess,
  getTeamStatisticsAccess,
  getTrainingRosterAccess,
} from '../../utils/registrations/bridge'

interface DiscordProfile {
  id: string
  username: string
  displayName: string | null
  avatarHash: string | null
}

type AuthErrorCode = 'access_denied' | 'oauth' | 'stats_unavailable'

const AUTH_RETURN_COOKIE = 'wolves-auth-return'
const ALLOWED_RETURN_TARGETS = new Set(['/mes-participations', '/admin/statistiques', '/creneaux'])

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseDiscordProfile(value: unknown): DiscordProfile | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const id = optionalString(record.id)
  const username = optionalString(record.username)

  if (!id || !username || !/^\d{17,20}$/.test(id)) return null

  return {
    id,
    username,
    displayName: optionalString(record.global_name),
    avatarHash: optionalString(record.avatar),
  }
}

function parseReturnTarget(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value

  return typeof candidate === 'string' && ALLOWED_RETURN_TARGETS.has(candidate) ? candidate : null
}

function authReturnCookieOptions(event: H3Event) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: getRequestURL(event).protocol === 'https:',
    path: '/auth/discord',
    maxAge: 10 * 60,
  }
}

function rememberReturnTarget(event: H3Event, value: unknown) {
  const returnTo = parseReturnTarget(value)

  if (returnTo) {
    setCookie(event, AUTH_RETURN_COOKIE, returnTo, authReturnCookieOptions(event))
  } else {
    deleteCookie(event, AUTH_RETURN_COOKIE, authReturnCookieOptions(event))
  }
}

function readReturnTarget(event: H3Event) {
  return parseReturnTarget(getCookie(event, AUTH_RETURN_COOKIE))
}

function clearReturnTarget(event: H3Event) {
  deleteCookie(event, AUTH_RETURN_COOKIE, authReturnCookieOptions(event))
}

async function redirectToLogin(
  event: H3Event,
  error: AuthErrorCode,
  returnTo = readReturnTarget(event),
) {
  await clearUserSession(event)
  clearReturnTarget(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const query = new URLSearchParams({ error })
  if (returnTo) query.set('redirect', returnTo)

  return sendRedirect(event, `/admin/login?${query}`)
}

function redirectAfterLogin(event: H3Event, fallback: string, returnTo: string | null) {
  clearReturnTarget(event)
  setHeader(event, 'Cache-Control', 'private, no-store')

  return sendRedirect(event, returnTo || fallback)
}

function updateKnownCmsUser(user: CmsUser, profile: DiscordProfile, lastLoginAt: string) {
  const observedProfile: CmsDiscordProfileInput = {
    username: profile.username,
    displayName: profile.displayName,
    avatarHash: profile.avatarHash,
    lastLoginAt,
  }

  return updateCmsUserDiscordProfile(user.discordId, observedProfile)
}

const discordOAuthHandler = defineOAuthDiscordEventHandler({
  config: {
    scope: ['identify'],
    emailRequired: false,
    profileRequired: true,
  },
  async onSuccess(event, { user: discordUser }) {
    const profile = parseDiscordProfile(discordUser)

    if (!profile) return redirectToLogin(event, 'oauth')
    const returnTo = readReturnTarget(event)

    const existingUser = findCmsUserByDiscordId(profile.id)
    const isConfiguredSuperAdmin = isConfiguredCmsSuperAdmin(event, profile.id)

    const lastLoginAt = new Date().toISOString()
    let cmsUser: CmsUser | null = null

    if (isConfiguredSuperAdmin) {
      cmsUser = upsertCmsUser({
        ...(existingUser ? { id: existingUser.id } : {}),
        discordId: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarHash: profile.avatarHash,
        role: 'super_admin',
        isActive: true,
        lastLoginAt,
      })
    } else if (existingUser?.isActive && existingUser.role !== 'super_admin') {
      cmsUser = updateKnownCmsUser(existingUser, profile, lastLoginAt)
    }

    if (!cmsUser) {
      try {
        const trainingAccess = await getTrainingAnnouncementAccess(event, profile.id)

        if (trainingAccess.canManage) {
          await replaceUserSession(event, {
            user: {
              discordId: profile.id,
              username: profile.username,
              displayName: profile.displayName,
            },
          })

          return redirectAfterLogin(event, '/admin/annonces', returnTo)
        }
      } catch {
        // A temporary bridge failure must not prevent a known participant
        // from using the rest of the private member area.
      }

      try {
        const statisticsAccess = await getTeamStatisticsAccess(event, profile.id)
        if (statisticsAccess.canAccess) {
          await replaceUserSession(event, {
            user: {
              discordId: profile.id,
              username: profile.username,
              displayName: profile.displayName,
            },
          })
          return redirectAfterLogin(event, '/admin/statistiques', returnTo)
        }
      } catch {
        // Un coach peut conserver son accès membre si le service statistiques est indisponible.
      }

      if (returnTo === '/creneaux') {
        try {
          const rosterAccess = await getTrainingRosterAccess(event, profile.id)
          if (rosterAccess.canAccess) {
            await replaceUserSession(event, {
              user: {
                discordId: profile.id,
                username: profile.username,
                displayName: profile.displayName,
              },
            })
            return redirectAfterLogin(event, '/creneaux', returnTo)
          }
        } catch {
          // Les autres espaces restent accessibles selon leurs propres droits.
        }
      }

      let participationAccess
      try {
        participationAccess = await getMemberParticipationAccess(event, profile.id)
      } catch {
        return redirectToLogin(event, 'stats_unavailable', returnTo)
      }

      if (!participationAccess.canAccess) {
        return redirectToLogin(event, 'access_denied', returnTo)
      }

      let registrationEligible = false
      try {
        registrationEligible = (await getSelfRegistration(event, profile.id)).eligible
      } catch {
        // L'accès membre est déjà confirmé par le garde dédié. Une panne de
        // l'inscription en temps réel ne doit pas bloquer l'historique.
      }

      await replaceUserSession(event, {
        user: {
          discordId: profile.id,
          username: profile.username,
          displayName: profile.displayName,
        },
      })

      return redirectAfterLogin(
        event,
        registrationEligible ? '/inscriptions' : '/mes-participations',
        returnTo,
      )
    }

    await replaceUserSession(event, {
      user: {
        discordId: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        userId: cmsUser.id,
      },
    })

    return redirectAfterLogin(event, '/admin', returnTo)
  },
  onError(event) {
    return redirectToLogin(event, 'oauth')
  },
})

export default defineEventHandler((event) => {
  const query = getQuery(event)

  if (!query.code && !query.error) {
    rememberReturnTarget(event, query.returnTo)
  }

  return discordOAuthHandler(event)
})
