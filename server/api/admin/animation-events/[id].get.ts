import { createError, getRouterParam, setHeader } from 'h3'

import { isAnimationEventOpaqueId } from '../../../../shared/animation-events/validation'
import { requireAuthenticatedDiscordUser } from '../../../utils/cms-authorization'
import { getAnimationEvent } from '../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  const eventId = getRouterParam(event, 'id') || ''
  if (!isAnimationEventOpaqueId(eventId)) {
    throw createError({ statusCode: 400, statusMessage: "Identifiant d'événement invalide." })
  }
  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => getAnimationEvent(event, discordId, eventId),
  )
})
