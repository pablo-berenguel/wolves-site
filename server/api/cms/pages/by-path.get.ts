import { createError, getQuery, getRequestHeader, setHeader, setResponseStatus } from 'h3'

import { getPublishedPageByPath } from '../../../utils/cms/repository'

function normalizePath(value: unknown) {
  if (typeof value !== 'string') return ''
  const path = value.trim()
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#') ||
    path.length > 500
  ) {
    return ''
  }
  return path === '/' ? '/' : path.replace(/\/+$/, '')
}

export default defineEventHandler((event) => {
  const path = normalizePath(getQuery(event).path)
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Chemin de page invalide.' })
  }

  const page = getPublishedPageByPath(path)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Page introuvable.' })
  }

  const etag = `"cms-${page.revisionId}"`
  setHeader(event, 'Cache-Control', 'public, max-age=0, must-revalidate')
  setHeader(event, 'ETag', etag)
  if (getRequestHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return null
  }

  return page
})
