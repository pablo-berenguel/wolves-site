import { createError, getRouterParam, readBody, setHeader } from 'h3'

import {
  isAnimationEventOpaqueId,
  validateAnimationEventGroupConfigRequest,
} from '../../../../../../../shared/animation-events/validation'
import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../../../../utils/cms-authorization'
import { saveAnimationEventGroupConfig } from '../../../../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)
  const eventId = getRouterParam(event, 'id') || ''
  const slotId = getRouterParam(event, 'slotId') || ''
  if (!isAnimationEventOpaqueId(eventId) || !isAnimationEventOpaqueId(slotId)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide.' })
  }
  const request = validateAnimationEventGroupConfigRequest(await readBody<unknown>(event))
  if (!request.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Le plan de groupes est invalide.',
      data: { issues: request.issues },
    })
  }

  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => saveAnimationEventGroupConfig(event, discordId, eventId, slotId, request.value),
  )
})
