export const MATOMO_PREFERENCE_EVENT = 'wolves:matomo-preference'
export const MATOMO_OPT_OUT_COOKIE = 'wolves_matomo_optout'
export const MATOMO_OPT_OUT_MAX_AGE_DAYS = 180
export const MATOMO_SCROLL_THRESHOLDS = [25, 50, 75, 100] as const
export const LEGACY_ANALYTICS_COOKIE_CLEANUP_UNTIL = Date.parse('2027-03-03T00:00:00Z')

const PRIVATE_ROUTE_PREFIXES = [
  '/admin',
  '/auth',
  '/inscriptions',
  '/mes-participations',
  '/creneaux',
] as const
const DOWNLOAD_EXTENSION = /\.([a-z0-9]{1,8})$/iu
const DOWNLOAD_EXTENSIONS = new Set([
  '7z',
  'csv',
  'doc',
  'docx',
  'gz',
  'ics',
  'jpeg',
  'jpg',
  'odp',
  'ods',
  'odt',
  'pdf',
  'png',
  'ppt',
  'pptx',
  'rar',
  'tar',
  'webp',
  'xls',
  'xlsx',
  'zip',
])

export interface MatomoPreferenceDetail {
  optedOut: boolean
  persisted: boolean
}

export interface MatomoLinkEvent {
  action: 'Contact' | 'Lien externe' | 'Lien interne' | 'Téléchargement'
  name: string
}

export function normalizeMatomoUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null

  try {
    const url = new URL(value.trim())
    const isLocalDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (
      (url.protocol !== 'https:' && !(isLocalDevelopment && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }

    url.pathname = `${url.pathname.replace(/\/+$/u, '')}/`
    return url.href
  } catch {
    return null
  }
}

export function normalizeMatomoSiteId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const siteId = String(value).trim()
  return /^[1-9]\d*$/u.test(siteId) ? siteId : null
}

export function shouldTrackAnalyticsPath(path: string): boolean {
  const [pathname = '/'] = path.split(/[?#]/u, 1)

  return !PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function sanitizeMatomoReferrer(value: string): string {
  if (value === '') return ''

  try {
    const url = new URL(value)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
      return ''
    }

    return url.origin
  } catch {
    return ''
  }
}

export function classifyMatomoLink(
  href: string,
  currentOrigin: string,
  explicitDownload = false,
): MatomoLinkEvent | null {
  const normalizedHref = href.trim()
  if (normalizedHref === '' || normalizedHref.startsWith('#')) return null

  if (/^mailto:/iu.test(normalizedHref)) {
    return { action: 'Contact', name: 'E-mail' }
  }
  if (/^tel:/iu.test(normalizedHref)) {
    return { action: 'Contact', name: 'Téléphone' }
  }

  try {
    const currentUrl = new URL(currentOrigin)
    const destination = new URL(normalizedHref, currentUrl)
    if (!['http:', 'https:'].includes(destination.protocol)) return null

    const extension = DOWNLOAD_EXTENSION.exec(destination.pathname)?.[1]?.toLowerCase()
    if (explicitDownload || (extension && DOWNLOAD_EXTENSIONS.has(extension))) {
      return {
        action: 'Téléchargement',
        name: extension ? extension.toUpperCase() : 'Fichier',
      }
    }

    if (destination.origin !== currentUrl.origin) {
      return { action: 'Lien externe', name: destination.hostname }
    }

    if (!shouldTrackAnalyticsPath(destination.pathname)) return null
    return { action: 'Lien interne', name: destination.pathname }
  } catch {
    return null
  }
}

export function getNewMatomoScrollThresholds(
  depth: number,
  lastReportedDepth: number,
): readonly number[] {
  const normalizedDepth = Math.max(0, Math.min(100, depth))
  return MATOMO_SCROLL_THRESHOLDS.filter(
    (threshold) => threshold > lastReportedDepth && threshold <= normalizedDepth,
  )
}

export function getLegacyAnalyticsCookieExpiryValues(
  cookieHeader: string,
  hostname: string,
  secure: boolean,
  now = Date.now(),
): readonly string[] {
  if (now >= LEGACY_ANALYTICS_COOKIE_CLEANUP_UNTIL) return []

  const cookieNames = [
    ...new Set(
      cookieHeader
        .split(';')
        .map((part) => part.trim().split('=', 1)[0] ?? '')
        .filter((name) => name === 'tarteaucitron' || /^_ga(?:_|$)/u.test(name)),
    ),
  ]
  if (cookieNames.length === 0) return []

  const domains = [
    '',
    ...(hostname.includes('.') ? [hostname] : []),
    ...(hostname.startsWith('www.') ? [hostname.slice(4)] : []),
  ]
  const secureAttribute = secure ? '; Secure' : ''

  return cookieNames.flatMap((name) =>
    [...new Set(domains)].map(
      (domain) =>
        `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
          domain ? `; Domain=${domain}` : ''
        }; SameSite=Lax${secureAttribute}`,
    ),
  )
}

export function hasMatomoOptOutCookie(cookieHeader: string): boolean {
  return cookieHeader.split(';').some((part) => {
    const [name, value] = part.trim().split('=', 2)
    return name === MATOMO_OPT_OUT_COOKIE && value === '1'
  })
}

export function matomoOptOutCookieValue(optedOut: boolean, secure: boolean): string {
  const attributes = [
    `${MATOMO_OPT_OUT_COOKIE}=${optedOut ? '1' : ''}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${optedOut ? MATOMO_OPT_OUT_MAX_AGE_DAYS * 24 * 60 * 60 : 0}`,
  ]
  if (secure) attributes.push('Secure')

  return attributes.join('; ')
}

export function isMatomoOptedOut(): boolean {
  return hasMatomoOptOutCookie(document.cookie)
}

export function setMatomoOptOut(optedOut: boolean): boolean {
  document.cookie = matomoOptOutCookieValue(optedOut, window.location.protocol === 'https:')
  return isMatomoOptedOut() === optedOut
}
