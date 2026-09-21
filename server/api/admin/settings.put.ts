import { createError, readBody, setHeader } from 'h3'

import { setCmsSettings } from '../../utils/cms/repository'
import { requireCmsMutationRole } from '../../utils/cms-authorization'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, maxLength = 300) {
  if (typeof value !== 'string') return ''

  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
    .trim()
    .slice(0, maxLength)
}

function url(value: unknown) {
  const candidate = text(value, 2_048)
  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) {
    return candidate
  }
  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

interface CmsNavigationItem {
  label: string
  to: string
  children?: CmsNavigationItem[]
}

function navigationItems(value: unknown, depth = 0): CmsNavigationItem[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 30).flatMap((candidate) => {
    if (!isRecord(candidate)) return []
    const label = text(candidate.label, 80)
    const to = url(candidate.to)
    if (!label || !to) return []
    return [
      {
        label,
        to,
        ...(depth < 2 && Array.isArray(candidate.children)
          ? { children: navigationItems(candidate.children, depth + 1).slice(0, 12) }
          : {}),
      },
    ]
  })
}

function socialItems(value: unknown) {
  const platforms = new Set(['Instagram', 'Facebook', 'YouTube', 'TikTok'])
  if (!Array.isArray(value)) return []
  return value.slice(0, 12).flatMap((candidate) => {
    if (!isRecord(candidate)) return []
    const platform = text(candidate.platform, 20)
    const socialUrl = url(candidate.url)
    if (!platforms.has(platform) || !socialUrl) return []
    return [
      {
        platform,
        label: text(candidate.label, 160) || `Suivre les Wolves sur ${platform}`,
        url: socialUrl,
        href: socialUrl,
        icon: platform.toLowerCase(),
      },
    ]
  })
}

export default defineEventHandler(async (event) => {
  const actor = await requireCmsMutationRole(event, 'admin')
  const body = await readBody<unknown>(event)
  if (!isRecord(body) || !isRecord(body.site) || !isRecord(body.site.address)) {
    throw createError({ statusCode: 400, statusMessage: 'Réglages invalides.' })
  }

  const sourceSite = body.site
  const sourceAddress = sourceSite.address as Record<string, unknown>
  const site = {
    name: text(sourceSite.name, 160),
    shortName: text(sourceSite.shortName, 100),
    tagline: text(sourceSite.tagline, 160),
    description: text(sourceSite.description, 500),
    footerDescription: text(sourceSite.footerDescription, 240),
    founded:
      typeof sourceSite.founded === 'number' && Number.isInteger(sourceSite.founded)
        ? sourceSite.founded
        : 2014,
    location: text(sourceSite.location, 200),
    logo: url(sourceSite.logo),
    heroImage: url(sourceSite.heroImage),
    address: {
      street: text(sourceAddress.street, 160),
      postalCode: text(sourceAddress.postalCode, 20),
      city: text(sourceAddress.city, 100),
      country: text(sourceAddress.country, 100),
      formatted: text(sourceAddress.formatted, 240),
    },
  }
  const navigation = navigationItems(body.navigation)
  const footerLinks = navigationItems(body.footerLinks)
  const socials = socialItems(body.socials)

  if (
    !site.name ||
    !site.shortName ||
    !site.description ||
    !site.footerDescription ||
    !site.logo ||
    !site.address.street ||
    !site.address.city ||
    navigation.length === 0
  ) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Des réglages obligatoires sont manquants.',
    })
  }

  setCmsSettings(
    {
      'site.identity': site,
      'site.navigation': navigation,
      'site.footerLinks': footerLinks,
      'site.socials': socials,
    },
    actor.id,
  )

  setHeader(event, 'Cache-Control', 'private, no-store')
  return { site, navigation, footerLinks, socials }
})
