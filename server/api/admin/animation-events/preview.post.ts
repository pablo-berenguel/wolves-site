import { createError, readBody, setHeader } from 'h3'

import { validateAnimationEventDraft } from '../../../../shared/animation-events/validation'
import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../utils/cms-authorization'
import { previewAnimationEvent } from '../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)
  const body = await readBody<unknown>(event)
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : null
  const draft = validateAnimationEventDraft(source && 'event' in source ? source.event : null)
  if (!draft.success) {
    throw createError({
      statusCode: 422,
      statusMessage: "L'événement est invalide.",
      data: { issues: draft.issues },
    })
  }

  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => previewAnimationEvent(event, discordId, draft.value),
  )
})
