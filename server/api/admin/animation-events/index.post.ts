import { createError, readBody, setHeader } from 'h3'

import { validateAnimationEventCreateRequest } from '../../../../shared/animation-events/validation'
import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../utils/cms-authorization'
import { createAnimationEvent } from '../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)
  const request = validateAnimationEventCreateRequest(await readBody<unknown>(event))
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
    (discordId) => createAnimationEvent(event, discordId, request.value),
  )
})
