import Busboy, { type BusboyFileStream } from '@fastify/busboy'
import { createWriteStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import type { H3Event } from 'h3'
import { createError } from 'h3'

export const CMS_UPLOAD_MAX_BYTES = 10 * 1024 * 1024

let uploadQueue = Promise.resolve()

export function withCmsUploadSlot<T>(operation: () => Promise<T>): Promise<T> {
  const result = uploadQueue.then(operation, operation)
  uploadQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export interface CmsTemporaryUpload {
  path: string
  originalFilename: string
  declaredMimeType: string
  cleanup: () => Promise<void>
}

function uploadError(statusCode: number, statusMessage: string) {
  return createError({ statusCode, statusMessage })
}

/**
 * Streams one multipart image to /tmp without buffering the request in memory.
 * The image decoder performs the authoritative format validation afterwards.
 */
export async function readCmsImageUpload(event: H3Event): Promise<CmsTemporaryUpload> {
  const contentType = event.node.req.headers['content-type']

  if (!contentType?.toLowerCase().startsWith('multipart/form-data;')) {
    throw uploadError(415, 'Un formulaire multipart contenant une image est attendu.')
  }

  const declaredLength = Number(event.node.req.headers['content-length'] ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > CMS_UPLOAD_MAX_BYTES + 128 * 1024) {
    throw uploadError(413, 'L’image dépasse la limite de 10 Mio.')
  }

  const temporaryPath = `/tmp/wolves-cms-upload-${randomUUID()}`
  let originalFilename = ''
  let declaredMimeType = ''
  let receivedFile = false
  let limitReached = false
  let writePromise: Promise<void> | undefined

  const cleanup = async () => {
    await unlink(temporaryPath).catch(() => undefined)
  }

  try {
    const parser = new Busboy({
      headers: { ...event.node.req.headers, 'content-type': contentType },
      limits: {
        files: 1,
        fields: 0,
        parts: 1,
        fileSize: CMS_UPLOAD_MAX_BYTES,
        fieldNameSize: 64,
        headerPairs: 32,
        headerSize: 16 * 1024,
      },
    })

    const parsed = new Promise<void>((resolve, reject) => {
      parser.on(
        'file',
        (
          fieldName: string,
          file: BusboyFileStream,
          filename: string,
          _transferEncoding: string,
          mimeType: string,
        ) => {
          if (receivedFile || fieldName !== 'image') {
            file.resume()
            limitReached = true
            return
          }

          receivedFile = true
          originalFilename = filename.slice(0, 180)
          declaredMimeType = mimeType.slice(0, 100)

          file.once('limit', () => {
            limitReached = true
          })

          writePromise = pipeline(
            file,
            createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }),
          )
        },
      )
      parser.once('filesLimit', () => {
        limitReached = true
      })
      parser.once('partsLimit', () => {
        limitReached = true
      })
      parser.once('error', reject)
      parser.once('finish', resolve)
      event.node.req.once('aborted', () => reject(uploadError(400, 'Téléversement interrompu.')))
      event.node.req.once('error', reject)
    })

    event.node.req.pipe(parser)
    await parsed
    await writePromise

    if (limitReached) {
      throw uploadError(413, 'Une seule image de 10 Mio maximum est acceptée.')
    }
    if (!receivedFile || !writePromise) {
      throw uploadError(400, 'Le champ « image » est manquant.')
    }

    return {
      path: temporaryPath,
      originalFilename,
      declaredMimeType,
      cleanup,
    }
  } catch (error) {
    await cleanup()
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw uploadError(400, 'Le téléversement de l’image est invalide.')
  }
}
