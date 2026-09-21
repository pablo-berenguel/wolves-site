import { requireAuthenticatedDiscordUser } from '../../../utils/cms-authorization'
import { withTeamStatisticsActor } from '../../../utils/participations/team-dashboard'
import { getTeamStatisticsOverview } from '../../../utils/registrations/bridge'

export default defineEventHandler(async (event) =>
  withTeamStatisticsActor(event, requireAuthenticatedDiscordUser, (discordId, year) =>
    getTeamStatisticsOverview(event, discordId, year),
  ),
)
