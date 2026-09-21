import { createError, getRouterParam, readBody, setHeader } from 'h3'

import { getDraftPageById, publishCmsPage } from '../../../../utils/cms/repository'
import { requireCmsMutationRole } from '../../../../utils/cms-authorization'

export default defineEventHandler(async (event) => {
  const actor = await requireCmsMutationRole(event, 'admin')
  const pageId = getRouterParam(event, 'id') || ''
  const draft = getDraftPageById(pageId)
  if (!draft) throw createError({ statusCode: 404, statusMessage: 'Page introuvable.' })

  const body = await readBody<{ revisionId?: unknown }>(event)
  const revisionId = typeof body?.revisionId === 'string' ? body.revisionId.trim() : ''
  if (!revisionId || revisionId !== draft.revisionId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cette page a changé. Recharge-la avant de publier.',
    })
  }

  const page = publishCmsPage(pageId, revisionId, actor.id)
  setHeader(event, 'Cache-Control', 'private, no-store')

  return { page }
})
