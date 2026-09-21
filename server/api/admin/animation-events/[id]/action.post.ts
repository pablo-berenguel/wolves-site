import { createError, getRouterParam, readBody, setHeader } from 'h3'

import {
  isAnimationEventOpaqueId,
  validateAnimationEventActionRequest,
} from '../../../../../shared/animation-events/validation'
import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../../utils/cms-authorization'
import { performAnimationEventAction } from '../../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)
  const eventId = getRouterParam(event, 'id') || ''
  if (!isAnimationEventOpaqueId(eventId)) {
    throw createError({ statusCode: 400, statusMessage: "Identifiant d'événement invalide." })
  }
  const request = validateAnimationEventActionRequest(await readBody<unknown>(event))
  if (!request.success) {
    throw createError({
      statusCode: 422,
      statusMessage: "L'action est invalide.",
      data: { issues: request.issues },
    })
  }

  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => performAnimationEventAction(event, discordId, eventId, request.value),
  )
})
