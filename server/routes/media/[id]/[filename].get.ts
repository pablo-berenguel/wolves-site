import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import {
  createError,
  getRequestHeader,
  getRouterParam,
  sendStream,
  setHeader,
  setResponseStatus,
} from 'h3'

import { parseCmsMediaRouteParams } from '../../../utils/cms-media-route'
import { listCmsMediaVariants } from '../../../utils/cms/repository'

export default defineEventHandler(async (event) => {
  const routeParams = parseCmsMediaRouteParams(
    getRouterParam(event, 'id') || '',
    getRouterParam(event, 'filename') || '',
  )
  if (!routeParams) {
    throw createError({ statusCode: 404, statusMessage: 'Média introuvable.' })
  }

  const variant = listCmsMediaVariants(routeParams.mediaId).find(
    (candidate) =>
      candidate.variant === routeParams.preset && candidate.checksum === routeParams.checksum,
  )
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: 'Variante introuvable.' })
  }

  const dataDirectory = String(useRuntimeConfig(event).cmsDataDir || '.data')
  const mediaRoot = resolve(dataDirectory, 'media')
  const filePath = resolve(mediaRoot, variant.path)
  if (!filePath.startsWith(`${mediaRoot}${sep}`)) {
    throw createError({ statusCode: 404, statusMessage: 'Média introuvable.' })
  }

  const fileStats = await stat(filePath).catch(() => null)
  if (!fileStats?.isFile()) {
    throw createError({ statusCode: 404, statusMessage: 'Fichier média introuvable.' })
  }

  const etag = `"${variant.checksum}"`
  setHeader(event, 'Content-Type', 'image/webp')
  setHeader(event, 'Content-Length', fileStats.size)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'ETag', etag)

  if (getRequestHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return null
  }

  return sendStream(event, createReadStream(filePath))
})
