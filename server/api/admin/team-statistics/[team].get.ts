import { getRouterParam } from 'h3'

import { requireAuthenticatedDiscordUser } from '../../../utils/cms-authorization'
import {
  parseTeamStatisticsTeam,
  withTeamStatisticsActor,
} from '../../../utils/participations/team-dashboard'
import { getTeamStatisticsDetail } from '../../../utils/registrations/bridge'

export default defineEventHandler(async (event) =>
  withTeamStatisticsActor(event, requireAuthenticatedDiscordUser, (discordId, year) =>
    getTeamStatisticsDetail(
      event,
      discordId,
      parseTeamStatisticsTeam(getRouterParam(event, 'team')),
      year,
    ),
  ),
)
