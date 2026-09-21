import { createError, getRouterParam, readBody, setHeader } from 'h3'

import {
  isAnimationEventOpaqueId,
  validateAnimationEventUpdateRequest,
} from '../../../../shared/animation-events/validation'
import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../utils/cms-authorization'
import { updateAnimationEvent } from '../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)
  const eventId = getRouterParam(event, 'id') || ''
  if (!isAnimationEventOpaqueId(eventId)) {
    throw createError({ statusCode: 400, statusMessage: "Identifiant d'événement invalide." })
  }
  const request = validateAnimationEventUpdateRequest(await readBody<unknown>(event))
  if (!request.success) {
    throw createError({
      statusCode: 422,
      statusMessage: "L'événement est invalide.",
      data: { issues: request.issues },
    })
  }

  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => updateAnimationEvent(event, discordId, eventId, request.value),
  )
})
