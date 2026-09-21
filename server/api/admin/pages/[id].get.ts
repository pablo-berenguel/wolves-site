import { createError, getRouterParam, setHeader } from 'h3'

import { getDraftPageById } from '../../../utils/cms/repository'
import { requireCmsRole } from '../../../utils/cms-authorization'

export default defineEventHandler(async (event) => {
  await requireCmsRole(event, 'editor')
  const pageId = getRouterParam(event, 'id') || ''
  const page = getDraftPageById(pageId)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page introuvable.' })

  setHeader(event, 'Cache-Control', 'private, no-store')
  return { page }
})
