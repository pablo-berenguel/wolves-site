const DISCORD_UNAVAILABLE_MESSAGES = {
  training:
    'La mise à jour Discord n’a pas pu être confirmée. Recharge l’annonce puis réessaie avec la même modification.',
  animation:
    'La mise à jour Discord n’a pas pu être confirmée. Recharge l’événement puis réessaie avec la même modification.',
} as const

export interface MappedBridgeError {
  statusCode: number
  statusMessage: string
  data: { code: 'discord_unavailable' }
}

export function mapBridgeServiceUnavailable(
  pathWithQuery: string,
  status: number,
  remoteCode: string,
): MappedBridgeError | null {
  if (status !== 503 || remoteCode !== 'discord_unavailable') return null

  const scope = pathWithQuery.startsWith('/v1/admin/training-announcements')
    ? 'training'
    : pathWithQuery.startsWith('/v1/admin/animation-events')
      ? 'animation'
      : null
  if (!scope) return null

  return {
    statusCode: 503,
    statusMessage: DISCORD_UNAVAILABLE_MESSAGES[scope],
    data: { code: 'discord_unavailable' },
  }
}
