import { setHeader } from 'h3'

import { listCmsPages } from '../../../utils/cms/repository'
import { requireCmsRole } from '../../../utils/cms-authorization'

export default defineEventHandler(async (event) => {
  await requireCmsRole(event, 'editor')
  setHeader(event, 'Cache-Control', 'private, no-store')

  return listCmsPages()
})
