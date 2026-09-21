import type { CmsValidationIssue } from '../../shared/cms/sanitize'
import { cmsBlockRegistry, cmsSeoImageFieldSchema } from '../../shared/cms/registry'
import type { CmsFieldSchema, CmsImageFieldPreset, CmsPage } from '../../shared/cms/types'
import type { CmsMedia, CmsMediaVariant } from '../../shared/types/cms'

export interface CmsImageReferenceStore {
  getCmsMediaById(id: string): CmsMedia | null
  listCmsMediaVariants(mediaId: string): CmsMediaVariant[]
}

interface ImageCandidate {
  mediaId?: unknown
  src?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getManagedCmsImageUrl(
  mediaId: string,
  preset: CmsImageFieldPreset,
  checksum: string,
): string {
  return `/media/${encodeURIComponent(mediaId)}/${preset}-${checksum}.webp`
}

export function validateCmsPageImageReferences(
  page: Pick<CmsPage, 'blocks' | 'seo'>,
  store: CmsImageReferenceStore,
): CmsValidationIssue[] {
  const issues: CmsValidationIssue[] = []
  const mediaCache = new Map<string, CmsMedia | null>()
  const variantsCache = new Map<string, CmsMediaVariant[]>()

  const getMedia = (mediaId: string) => {
    if (!mediaCache.has(mediaId)) {
      mediaCache.set(mediaId, store.getCmsMediaById(mediaId))
    }
    return mediaCache.get(mediaId) ?? null
  }

  const getVariants = (mediaId: string) => {
    if (!variantsCache.has(mediaId)) {
      variantsCache.set(mediaId, store.listCmsMediaVariants(mediaId))
    }
    return variantsCache.get(mediaId) ?? []
  }

  const validateImage = (candidate: ImageCandidate, preset: CmsImageFieldPreset, path: string) => {
    const mediaId = typeof candidate.mediaId === 'string' ? candidate.mediaId : ''
    const src = typeof candidate.src === 'string' ? candidate.src : ''
    if (!mediaId || !src) {
      issues.push({
        path,
        message: 'Cette image doit référencer un média CMS et son URL interne.',
      })
      return
    }

    const media = getMedia(mediaId)
    if (!media) {
      issues.push({ path: `${path}.mediaId`, message: 'Ce média CMS n’existe pas.' })
      return
    }

    if (media.storageKind === 'bundled') {
      if (src !== media.originalPath) {
        issues.push({
          path: `${path}.src`,
          message: 'L’URL ne correspond pas au fichier intégré de ce média.',
        })
      }
      return
    }

    const matchingVariants = getVariants(mediaId).filter(
      (variant) => variant.variant === preset && variant.mimeType === 'image/webp',
    )
    if (matchingVariants.length === 0) {
      issues.push({
        path: `${path}.mediaId`,
        message: `Ce média ne possède pas de variante WebP « ${preset} ».`,
      })
      return
    }

    const matchesKnownVariant = matchingVariants.some(
      (variant) => src === getManagedCmsImageUrl(mediaId, preset, variant.checksum),
    )
    if (!matchesKnownVariant) {
      issues.push({
        path: `${path}.src`,
        message: `L’URL doit utiliser la variante « ${preset} » de ce média.`,
      })
    }
  }

  const visit = (schema: CmsFieldSchema, value: unknown, path: string): void => {
    if (value === undefined || value === null) return

    if (schema.kind === 'image') {
      if (isRecord(value)) {
        validateImage(value, schema.imagePreset ?? 'card', path)
      }
      return
    }

    if (schema.kind === 'object') {
      if (!isRecord(value)) return
      for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
        visit(fieldSchema, value[fieldName], `${path}.${fieldName}`)
      }
      return
    }

    if (schema.kind === 'list') {
      if (!Array.isArray(value)) return
      value.forEach((item, index) => visit(schema.item, item, `${path}.${index}`))
    }
  }

  visit(cmsSeoImageFieldSchema, page.seo.image, 'seo.image')

  page.blocks.forEach((block, blockIndex) => {
    const definition = cmsBlockRegistry[block.type]
    for (const [fieldName, schema] of Object.entries(definition.fields)) {
      visit(
        schema,
        (block.data as unknown as Record<string, unknown>)[fieldName],
        `blocks.${blockIndex}.data.${fieldName}`,
      )
    }
  })

  return issues
}
