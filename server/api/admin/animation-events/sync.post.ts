import { setHeader } from 'h3'

import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../utils/cms-authorization'
import { syncAnimationEvents } from '../../../utils/registrations/bridge'
import { withTrainingAnnouncementDiscordSession } from '../../../utils/registrations/protocol'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)

  return withTrainingAnnouncementDiscordSession(
    event,
    requireAuthenticatedDiscordUser,
    (discordId) => syncAnimationEvents(event, discordId),
  )
})
