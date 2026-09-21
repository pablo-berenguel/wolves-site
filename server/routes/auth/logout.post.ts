import { setHeader, setResponseStatus } from 'h3'

import { assertCmsMutationOrigin } from '../../utils/cms-authorization'

export default defineEventHandler(async (event) => {
  assertCmsMutationOrigin(event)
  await clearUserSession(event)

  setHeader(event, 'Cache-Control', 'private, no-store')
  setResponseStatus(event, 204)

  return null
})
