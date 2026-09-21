import { requireAuthenticatedDiscordUser } from '../../../utils/cms-authorization'
import { withTrainingRosterActor } from '../../../utils/participations/training-roster'
import { getTrainingRosterAccess } from '../../../utils/registrations/bridge'

export default defineEventHandler(async (event) =>
  withTrainingRosterActor(event, requireAuthenticatedDiscordUser, (discordId) =>
    getTrainingRosterAccess(event, discordId),
  ),
)
