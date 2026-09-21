import { createError, getRouterParam, send, setHeader } from 'h3'

import { isAnimationEventOpaqueId } from '../../../../../../shared/animation-events/validation'
import { requireAuthenticatedDiscordUser } from '../../../../../utils/cms-authorization'
import { getAnimationEventParticipantAvatar } from '../../../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cross-Origin-Resource-Policy', 'same-origin')

  const participantKey = getRouterParam(event, 'participantKey') || ''
  if (!isAnimationEventOpaqueId(participantKey)) {
    throw createError({ statusCode: 404, statusMessage: 'Avatar introuvable.' })
  }

  const avatar = await withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => getAnimationEventParticipantAvatar(event, discordId, participantKey),
  )

  setHeader(event, 'Content-Type', avatar.contentType)
  setHeader(event, 'Content-Length', avatar.bytes.byteLength)

  return send(event, avatar.bytes)
})
