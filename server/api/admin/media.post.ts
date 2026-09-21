import { createError, setHeader, type H3Event } from 'h3'

import type { CmsImage, CmsImagePreset } from '../../../shared/cms/types'
import { processCmsImage } from '../../utils/cms-image'
import { readCmsImageUpload, withCmsUploadSlot } from '../../utils/cms-upload'
import { getCmsDatabase } from '../../utils/cms/database'
import {
  CmsConflictError,
  createCmsMedia,
  getCmsMediaById,
  upsertCmsMediaVariant,
} from '../../utils/cms/repository'
import { requireCmsMutationRole } from '../../utils/cms-authorization'

async function handleMediaUpload(event: H3Event, actorUserId: string) {
  const upload = await readCmsImageUpload(event)

  try {
    const dataDirectory = String(useRuntimeConfig(event).cmsDataDir || '.data')
    const processed = await processCmsImage(upload.path, upload.originalFilename, dataDirectory)
    const mediaId = `media-${processed.sourceSha256.slice(0, 32)}`
    const master = processed.variants.find((variant) => variant.preset === 'master')
    if (!master) {
      throw createError({ statusCode: 500, statusMessage: 'Master WebP introuvable.' })
    }

    const persist = getCmsDatabase().transaction(() => {
      let media = getCmsMediaById(mediaId)
      if (!media) {
        try {
          media = createCmsMedia({
            id: mediaId,
            storageKind: 'managed',
            originalPath: master.relativePath,
            originalFilename: processed.originalFilename,
            mimeType: 'image/webp',
            byteSize: master.bytes,
            width: master.width,
            height: master.height,
            checksum: processed.sourceSha256,
            actorUserId,
          })
        } catch (error) {
          if (!(error instanceof CmsConflictError)) throw error
          media = getCmsMediaById(mediaId)
        }
      }

      if (!media) {
        throw createError({ statusCode: 500, statusMessage: 'Média introuvable après création.' })
      }

      const images = {} as Record<CmsImagePreset, CmsImage>
      for (const variant of processed.variants) {
        const storedVariant = upsertCmsMediaVariant({
          id: `variant-${mediaId}-${variant.preset}-${variant.sha256}`,
          mediaId,
          variant: variant.preset,
          path: variant.relativePath,
          mimeType: 'image/webp',
          byteSize: variant.bytes,
          width: variant.width,
          height: variant.height,
          checksum: variant.sha256,
        })

        images[variant.preset] = {
          mediaId,
          src: `/media/${mediaId}/${variant.preset}-${storedVariant.checksum}.webp`,
          alt: '',
          width: storedVariant.width,
          height: storedVariant.height,
        }
      }

      return { images, media }
    })
    const { images, media } = persist()

    setHeader(event, 'Cache-Control', 'private, no-store')
    return {
      image: images.card,
      variants: images,
      media,
    }
  } finally {
    await upload.cleanup()
  }
}

export default defineEventHandler(async (event) => {
  const actor = await requireCmsMutationRole(event, 'editor')

  return withCmsUploadSlot(() => handleMediaUpload(event, actor.id))
})
