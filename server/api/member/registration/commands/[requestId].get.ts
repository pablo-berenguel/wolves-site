import { createError, getRouterParam, setHeader } from 'h3'

import { requireAuthenticatedDiscordUser } from '../../../../utils/cms-authorization'
import { getSelfRegistrationCommand } from '../../../../utils/registrations/bridge'

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')

  const requestId = getRouterParam(event, 'requestId') || ''
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const user = await requireAuthenticatedDiscordUser(event)

  return getSelfRegistrationCommand(event, user.discordId, requestId)
})
