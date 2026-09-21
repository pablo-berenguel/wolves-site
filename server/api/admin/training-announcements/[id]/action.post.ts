import { createError, getRouterParam, readBody, setHeader } from 'h3'

import {
  isTrainingAnnouncementOpaqueId,
  validateTrainingAnnouncementActionRequest,
} from '../../../../../shared/training-announcements/validation'
import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../../utils/cms-authorization'
import { performTrainingAnnouncementAction } from '../../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)

  const announcementId = getRouterParam(event, 'id') || ''
  if (!isTrainingAnnouncementOpaqueId(announcementId)) {
    throw createError({ statusCode: 400, statusMessage: "Identifiant d'annonce invalide." })
  }

  const request = validateTrainingAnnouncementActionRequest(await readBody<unknown>(event))
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
    (discordId) =>
      performTrainingAnnouncementAction(event, discordId, announcementId, request.value),
  )
})
