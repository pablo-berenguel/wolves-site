import { createError, setHeader } from 'h3'

import { requireAuthenticatedDiscordUser } from '../../utils/cms-authorization'
import { getSelfRegistration } from '../../utils/registrations/bridge'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')

  const user = await requireAuthenticatedDiscordUser(event)
  const registration = await getSelfRegistration(event, user.discordId)

  if (!registration.eligible) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  return registration
})
