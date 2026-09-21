import { createError, getQuery, setHeader, type H3Event } from 'h3'

import type { AuthenticatedDiscordPrincipal } from './self-dashboard'
import { isTrainingRosterSessionKey } from '../registrations/training-roster-protocol'

export function parseTrainingRosterSelection(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (!isTrainingRosterSessionKey(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Créneau invalide.' })
  }
  return value
}

export async function withTrainingRosterActor<T>(
  event: H3Event,
  requireUser: (event: H3Event) => Promise<AuthenticatedDiscordPrincipal>,
  read: (discordId: string, sessionKey: string | undefined) => Promise<T>,
): Promise<T> {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  const user = await requireUser(event)
  return read(user.discordId, parseTrainingRosterSelection(getQuery(event).sessionKey))
}
