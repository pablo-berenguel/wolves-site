import { createError, readBody, setHeader } from 'h3'

import { validateTrainingAnnouncementCreateRequest } from '../../../../shared/training-announcements/validation'
import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../utils/cms-authorization'
import { createTrainingAnnouncement } from '../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)

  const request = validateTrainingAnnouncementCreateRequest(await readBody<unknown>(event))
  if (!request.success) {
    throw createError({
      statusCode: 422,
      statusMessage: "L'annonce est invalide.",
      data: { issues: request.issues },
    })
  }

  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => createTrainingAnnouncement(event, discordId, request.value),
  )
})
