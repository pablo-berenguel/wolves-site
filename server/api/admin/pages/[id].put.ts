import { createError, getRequestHeader, getRouterParam, readBody, setHeader } from 'h3'

import { sanitizeCmsPage } from '../../../../shared/cms/sanitize'
import { validateCmsPageImageReferences } from '../../../utils/cms-image-references'
import {
  getDraftPageById,
  getCmsMediaById,
  listCmsMediaVariants,
  saveCmsPageRevision,
} from '../../../utils/cms/repository'
import { requireCmsMutationRole } from '../../../utils/cms-authorization'

const MAX_PAGE_BODY_BYTES = 1024 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default defineEventHandler(async (event) => {
  const actor = await requireCmsMutationRole(event, 'editor')
  const pageId = getRouterParam(event, 'id') || ''
  const current = getDraftPageById(pageId)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Page introuvable.' })

  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_PAGE_BODY_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Le contenu de la page est trop volumineux.',
    })
  }

  const body = await readBody<unknown>(event)
  if (!isRecord(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Contenu de page invalide.' })
  }

  const expectedRevisionId =
    typeof body.expectedRevisionId === 'string' ? body.expectedRevisionId.trim() : ''
  if (!expectedRevisionId || expectedRevisionId !== current.revisionId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cette page a changé. Recharge-la avant d’enregistrer.',
    })
  }

  const sanitized = sanitizeCmsPage({
    id: current.id,
    path: current.path,
    status: 'draft',
    title: body.title,
    seo: body.seo,
    blocks: body.blocks,
  })

  if (!sanitized.success || !sanitized.value) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Certains champs du CMS sont invalides.',
      data: { issues: sanitized.issues },
    })
  }

  const imageIssues = validateCmsPageImageReferences(sanitized.value, {
    getCmsMediaById,
    listCmsMediaVariants,
  })
  if (imageIssues.length > 0) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Certaines images ne correspondent pas aux médias enregistrés.',
      data: { issues: imageIssues },
    })
  }

  const revision = saveCmsPageRevision({
    pageId,
    expectedRevisionId,
    title: sanitized.value.title,
    seo: sanitized.value.seo,
    blocks: sanitized.value.blocks,
    changeNote:
      typeof body.changeNote === 'string' ? body.changeNote.trim().slice(0, 300) : undefined,
    actorUserId: actor.id,
  })
  const page = getDraftPageById(pageId)
  if (!page) throw createError({ statusCode: 500, statusMessage: 'Brouillon introuvable.' })

  setHeader(event, 'Cache-Control', 'private, no-store')
  return { page, revision }
})
