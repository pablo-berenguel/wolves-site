import type { CmsBlock, CmsBlockType, CmsFieldSchema, CmsImage, CmsPage } from './types'
import { cmsBlockRegistry, isCmsBlockType, sortCmsBlocks } from './registry'

export interface CmsValidationIssue {
  path: string
  message: string
}

export interface CmsSanitizeResult<T> {
  success: boolean
  value: T | null
  issues: CmsValidationIssue[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown, maxLength: number, multiline: boolean) {
  if (typeof value !== 'string') return undefined

  const withoutControls = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
    })
    .join('')
  const normalized = multiline
    ? withoutControls.replace(/\r\n?/g, '\n').trim()
    : withoutControls.replace(/\s+/g, ' ').trim()

  return normalized.slice(0, maxLength)
}

export function sanitizeCmsUrl(value: unknown) {
  const url = normalizeString(value, 2_048, false)
  if (!url) return undefined

  if (
    (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) ||
    url.startsWith('#')
  ) {
    return url
  }

  try {
    const parsed = new URL(url)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)
      ? parsed.toString()
      : undefined
  } catch {
    return undefined
  }
}

function sanitizeImage(
  value: unknown,
  path: string,
  issues: CmsValidationIssue[],
  requireAlt = true,
): CmsImage | undefined {
  if (!isRecord(value)) return undefined

  const candidateSrc = sanitizeCmsUrl(value.src)
  const src = candidateSrc?.startsWith('/') ? candidateSrc : undefined
  const mediaId = normalizeString(value.mediaId, 160, false)
  if (!src || !mediaId) {
    issues.push({ path, message: 'Une image doit référencer un média CMS et son URL interne.' })
    return undefined
  }

  const decorative = value.decorative === true
  const alt = normalizeString(value.alt, 500, false) || ''
  if (requireAlt && !decorative && !alt) {
    issues.push({ path: `${path}.alt`, message: 'Le texte alternatif est requis.' })
  }

  const positiveInteger = (candidate: unknown) =>
    typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0
      ? candidate
      : undefined
  const percentage = (candidate: unknown) =>
    typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.min(100, Math.max(0, candidate))
      : undefined

  return {
    ...(mediaId ? { mediaId } : {}),
    src: src || '',
    alt,
    ...(positiveInteger(value.width) ? { width: positiveInteger(value.width) } : {}),
    ...(positiveInteger(value.height) ? { height: positiveInteger(value.height) } : {}),
    ...(percentage(value.focalX) !== undefined ? { focalX: percentage(value.focalX) } : {}),
    ...(percentage(value.focalY) !== undefined ? { focalY: percentage(value.focalY) } : {}),
    ...(decorative ? { decorative: true } : {}),
  }
}

function sanitizeField(
  schema: CmsFieldSchema,
  value: unknown,
  fallback: unknown,
  path: string,
  issues: CmsValidationIssue[],
): unknown {
  const source = value ?? fallback

  if (source === undefined || source === null) {
    if (schema.required) issues.push({ path, message: 'Ce champ est requis.' })
    return undefined
  }

  switch (schema.kind) {
    case 'text':
    case 'textarea': {
      const sanitized = normalizeString(
        source,
        schema.maxLength || (schema.kind === 'text' ? 200 : 2_000),
        schema.kind === 'textarea',
      )
      if (schema.required && !sanitized) issues.push({ path, message: 'Ce texte est requis.' })
      return sanitized
    }
    case 'url': {
      const sanitized = sanitizeCmsUrl(source)
      if (!sanitized && !schema.required && source === '') return undefined
      if (!sanitized) issues.push({ path, message: 'Cette URL est invalide.' })
      return sanitized
    }
    case 'image': {
      const sanitized = sanitizeImage(source, path, issues, schema.imageAltRequired !== false)
      if (schema.required && !sanitized) issues.push({ path, message: 'Cette image est requise.' })
      return sanitized
    }
    case 'boolean':
      return source === true
    case 'number': {
      if (typeof source !== 'number' || !Number.isFinite(source)) {
        issues.push({ path, message: 'Ce nombre est invalide.' })
        return undefined
      }
      return Math.min(schema.max ?? source, Math.max(schema.min ?? source, source))
    }
    case 'select': {
      const options = schema.options?.map((option) => option.value) || []
      if (source === '' && !schema.required) return undefined
      if (typeof source === 'string' && options.includes(source)) return source
      issues.push({ path, message: 'Cette option est invalide.' })
      return undefined
    }
    case 'object': {
      if (!isRecord(source)) {
        issues.push({ path, message: 'Cet objet est invalide.' })
        return undefined
      }
      const fallbackRecord = isRecord(fallback) ? fallback : {}
      return Object.fromEntries(
        Object.entries(schema.fields)
          .map(([key, childSchema]) => [
            key,
            sanitizeField(childSchema, source[key], fallbackRecord[key], `${path}.${key}`, issues),
          ])
          .filter(([, child]) => child !== undefined),
      )
    }
    case 'list': {
      const values = Array.isArray(source) ? source : []
      if (!Array.isArray(source)) issues.push({ path, message: 'Cette liste est invalide.' })
      const maxItems = schema.maxItems ?? 100
      const sanitized = values
        .slice(0, maxItems)
        .map((item, index) =>
          sanitizeField(schema.item, item, undefined, `${path}.${index}`, issues),
        )
        .filter((item) => item !== undefined)

      if (sanitized.length < (schema.minItems || 0)) {
        issues.push({
          path,
          message: `Cette liste doit contenir au moins ${schema.minItems} élément(s).`,
        })
      }
      return sanitized
    }
  }
}

function sanitizeIdentifier(value: unknown) {
  const identifier = normalizeString(value, 160, false)
  return identifier && /^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/.test(identifier) ? identifier : undefined
}

function sanitizeAnchor(value: unknown) {
  const anchor = normalizeString(value, 120, false)
  return anchor && /^[a-z][a-z0-9_-]*$/.test(anchor) ? anchor : undefined
}

export function sanitizeCmsBlock(input: unknown): CmsSanitizeResult<CmsBlock> {
  const issues: CmsValidationIssue[] = []
  if (!isRecord(input) || !isCmsBlockType(input.type)) {
    return {
      success: false,
      value: null,
      issues: [{ path: 'type', message: 'Le type de bloc est inconnu.' }],
    }
  }

  const type: CmsBlockType = input.type
  const definition = cmsBlockRegistry[type]
  const id = sanitizeIdentifier(input.id)
  if (!id) issues.push({ path: 'id', message: 'L’identifiant du bloc est invalide.' })

  const rawData = isRecord(input.data) ? input.data : {}
  let defaultVariant = definition.variants[0]
  if (type === 'hero') {
    defaultVariant = isRecord(rawData.video)
      ? 'home-video'
      : rawData.size === 'compact'
        ? 'compact'
        : 'page-image'
  } else if (type === 'split_content' && (rawData.badge || Array.isArray(rawData.stats))) {
    defaultVariant = 'story'
  } else if (type === 'cta_band') {
    defaultVariant = input.theme === 'raised' ? 'default' : 'compact'
  }
  const variant =
    typeof input.variant === 'string' && definition.variants.includes(input.variant as never)
      ? input.variant
      : defaultVariant
  const sortOrder =
    typeof input.sortOrder === 'number' && Number.isInteger(input.sortOrder) ? input.sortOrder : 0
  const theme = ['default', 'light', 'raised'].includes(String(input.theme))
    ? (input.theme as CmsBlock['theme'])
    : 'default'
  const fallbackData = definition.defaultData as unknown as Record<string, unknown>
  const data = Object.fromEntries(
    Object.entries(definition.fields)
      .map(([key, schema]) => [
        key,
        sanitizeField(schema, rawData[key], fallbackData[key], `data.${key}`, issues),
      ])
      .filter(([, value]) => value !== undefined),
  )

  const block = {
    id: id || 'invalid-block',
    type,
    variant,
    sortOrder,
    ...(sanitizeAnchor(input.anchor) ? { anchor: sanitizeAnchor(input.anchor) } : {}),
    theme,
    enabled: input.enabled !== false,
    schemaVersion: 1,
    data,
  } as CmsBlock

  return { success: issues.length === 0, value: block, issues }
}

function sanitizePagePath(value: unknown) {
  const path = normalizeString(value, 500, false)
  if (
    !path ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#')
  ) {
    return undefined
  }
  return path === '/' ? path : path.replace(/\/+$/, '')
}

export function sanitizeCmsPage(input: unknown): CmsSanitizeResult<CmsPage> {
  const issues: CmsValidationIssue[] = []
  if (!isRecord(input)) {
    return {
      success: false,
      value: null,
      issues: [{ path: '', message: 'La page est invalide.' }],
    }
  }

  const id = sanitizeIdentifier(input.id)
  const path = sanitizePagePath(input.path)
  const title = normalizeString(input.title, 200, false)
  if (!id) issues.push({ path: 'id', message: 'L’identifiant de page est invalide.' })
  if (!path) issues.push({ path: 'path', message: 'Le chemin de page est invalide.' })
  if (!title) issues.push({ path: 'title', message: 'Le titre de page est requis.' })

  const rawSeo = isRecord(input.seo) ? input.seo : {}
  const seoTitle = normalizeString(rawSeo.title, 200, false)
  const seoDescription = normalizeString(rawSeo.description, 500, false)
  if (!seoTitle) issues.push({ path: 'seo.title', message: 'Le titre SEO est requis.' })
  if (!seoDescription) {
    issues.push({ path: 'seo.description', message: 'La description SEO est requise.' })
  }

  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : []
  const blocks = rawBlocks.flatMap((rawBlock, index) => {
    const result = sanitizeCmsBlock(rawBlock)
    issues.push(
      ...result.issues.map((issue) => ({ ...issue, path: `blocks.${index}.${issue.path}` })),
    )
    return result.value ? [result.value] : []
  })
  const blockIds = new Set<string>()
  const blockAnchors = new Set<string>()
  blocks.forEach((block, index) => {
    if (blockIds.has(block.id)) {
      issues.push({
        path: `blocks.${index}.id`,
        message: 'Cet identifiant de bloc est déjà utilisé.',
      })
    }
    blockIds.add(block.id)

    if (block.anchor) {
      if (blockAnchors.has(block.anchor)) {
        issues.push({ path: `blocks.${index}.anchor`, message: 'Cette ancre est déjà utilisée.' })
      }
      blockAnchors.add(block.anchor)
    }
  })
  const headingBlocks = blocks.filter(
    (block) =>
      block.enabled &&
      (block.type === 'hero' || (block.type === 'rich_text' && block.variant === 'legal')),
  )
  if (headingBlocks.length !== 1) {
    issues.push({
      path: 'blocks',
      message: 'Une page doit contenir exactement un bloc principal Hero ou Texte structuré légal.',
    })
  }

  const page: CmsPage = {
    id: id || 'invalid-page',
    path: path || '/',
    title: title || '',
    status: input.status === 'published' ? 'published' : 'draft',
    seo: {
      title: seoTitle || '',
      description: seoDescription || '',
      ...(isRecord(rawSeo.image)
        ? { image: sanitizeImage(rawSeo.image, 'seo.image', issues, false) }
        : {}),
      noindex: rawSeo.noindex === true,
    },
    blocks: sortCmsBlocks(blocks),
    ...(normalizeString(input.createdAt, 80, false)
      ? { createdAt: normalizeString(input.createdAt, 80, false) }
      : {}),
    ...(normalizeString(input.updatedAt, 80, false)
      ? { updatedAt: normalizeString(input.updatedAt, 80, false) }
      : {}),
    ...(normalizeString(input.publishedAt, 80, false)
      ? { publishedAt: normalizeString(input.publishedAt, 80, false) }
      : {}),
  }

  return { success: issues.length === 0, value: page, issues }
}
