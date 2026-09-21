import { setHeader } from 'h3'

import { requireAuthenticatedDiscordUser } from '../../utils/cms-authorization'
import { getMemberParticipationProjection } from '../../utils/participations/projection'
import { getSelfParticipationDashboard } from '../../utils/participations/self-dashboard'
import { getMemberParticipationAccess } from '../../utils/registrations/bridge'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')

  return getSelfParticipationDashboard(event, {
    requireUser: requireAuthenticatedDiscordUser,
    getAccess: async (discordId) => getMemberParticipationAccess(event, discordId),
    getProjection: async (discordId) => getMemberParticipationProjection(discordId),
  })
})
