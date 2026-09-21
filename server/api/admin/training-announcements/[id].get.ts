import { createError, getRouterParam, setHeader } from 'h3'

import { isTrainingAnnouncementOpaqueId } from '../../../../shared/training-announcements/validation'
import { requireAuthenticatedDiscordUser } from '../../../utils/cms-authorization'
import { getTrainingAnnouncement } from '../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')

  const announcementId = getRouterParam(event, 'id') || ''
  if (!isTrainingAnnouncementOpaqueId(announcementId)) {
    throw createError({ statusCode: 400, statusMessage: "Identifiant d'annonce invalide." })
  }

  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => getTrainingAnnouncement(event, discordId, announcementId),
  )
})
