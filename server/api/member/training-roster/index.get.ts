import { requireAuthenticatedDiscordUser } from '../../../utils/cms-authorization'
import { withTrainingRosterActor } from '../../../utils/participations/training-roster'
import { getTrainingRoster } from '../../../utils/registrations/bridge'

export default defineEventHandler(async (event) =>
  withTrainingRosterActor(event, requireAuthenticatedDiscordUser, (discordId, sessionKey) =>
    getTrainingRoster(event, discordId, sessionKey),
  ),
)
