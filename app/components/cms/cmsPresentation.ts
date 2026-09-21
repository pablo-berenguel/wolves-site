import type { CmsAction, CmsBlockTheme, CmsImage } from '#shared/cms/types'

export function cmsSectionClasses(theme: CmsBlockTheme | undefined, compact = false) {
  return [
    'section',
    compact ? 'section--compact' : undefined,
    theme === 'light' ? 'section--light' : undefined,
    theme === 'raised' ? 'section--raised' : undefined,
  ]
}

export function cmsImageStyle(image: CmsImage | undefined) {
  if (!image) return undefined

  const x = image.focalX ?? 50
  const y = image.focalY ?? 50

  return {
    objectPosition: `${x}% ${y}%`,
  }
}

export function cmsBackgroundStyle(image: CmsImage | undefined, gradient?: string) {
  if (!image) return undefined

  const x = image.focalX ?? 50
  const y = image.focalY ?? 50

  return {
    backgroundImage: `${gradient ? `${gradient}, ` : ''}url("${image.src.replaceAll('"', '%22')}")`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundSize: 'cover',
  }
}

export function isInternalCmsLink(action: CmsAction) {
  return action.href.startsWith('/') || action.href.startsWith('#')
}

export function cmsActionArrow(action: CmsAction) {
  if (action.arrow === 'external') return '↗'
  if (action.arrow === 'right') return '→'
  return ''
}
