import { setHeader } from 'h3'

import { listCmsUsers } from '../../../utils/cms/repository'
import { requireCmsRole } from '../../../utils/cms-authorization'

export default defineEventHandler(async (event) => {
  await requireCmsRole(event, 'super_admin')
  setHeader(event, 'Cache-Control', 'private, no-store')

  return listCmsUsers()
})
