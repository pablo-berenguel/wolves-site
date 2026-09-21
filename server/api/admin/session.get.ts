import { setHeader } from 'h3'

import { requireCmsUser } from '../../utils/cms-authorization'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  return {
    user: await requireCmsUser(event),
  }
})
