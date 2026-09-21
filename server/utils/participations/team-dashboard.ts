import { createError, getQuery, setHeader, type H3Event } from 'h3'

import type { TeamStatisticsTeamKey } from '../../../shared/types/team-statistics'
import { isTeamStatisticsKey } from '../registrations/team-statistics-protocol'
import type { AuthenticatedDiscordPrincipal } from './self-dashboard'

export function parseTeamStatisticsYear(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^20\d{2}$|^2100$/.test(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Année invalide.' })
  }
  return Number(value)
}

export function parseTeamStatisticsTeam(value: unknown): TeamStatisticsTeamKey {
  if (!isTeamStatisticsKey(value)) {
    throw createError({ statusCode: 404, statusMessage: 'Équipe inconnue.' })
  }
  return value
}

/** L’acteur vient uniquement de la session ; l’API publique ne choisit jamais un membre. */
export async function withTeamStatisticsActor<T>(
  event: H3Event,
  requireUser: (event: H3Event) => Promise<AuthenticatedDiscordPrincipal>,
  read: (discordId: string, year: number | undefined) => Promise<T>,
): Promise<T> {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  const user = await requireUser(event)
  const year = parseTeamStatisticsYear(getQuery(event).year)
  return read(user.discordId, year)
}
