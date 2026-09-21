import { requireAuthenticatedDiscordUser } from '../../../utils/cms-authorization'
import { withTeamStatisticsActor } from '../../../utils/participations/team-dashboard'
import { getTeamStatisticsAccess } from '../../../utils/registrations/bridge'

export default defineEventHandler(async (event) =>
  withTeamStatisticsActor(event, requireAuthenticatedDiscordUser, (discordId) =>
    getTeamStatisticsAccess(event, discordId),
  ),
)
