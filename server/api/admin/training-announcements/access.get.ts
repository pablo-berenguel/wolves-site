import { setHeader } from 'h3'

import { requireAuthenticatedDiscordUser } from '../../../utils/cms-authorization'
import { getTrainingAnnouncementAccess } from '../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')

  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => getTrainingAnnouncementAccess(event, discordId),
  )
})
