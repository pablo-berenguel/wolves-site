import type { NavItem, SiteIdentity, SocialLink } from '~/data/site'
import {
  footerLinks as defaultFooterLinks,
  navigation as defaultNavigation,
  site as defaultSite,
  socials as defaultSocials,
} from '~/data/site'

export interface CmsGlobals {
  site: SiteIdentity
  navigation: NavItem[]
  footerLinks: NavItem[]
  socials: SocialLink[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeGlobals(value: unknown): CmsGlobals {
  if (!isRecord(value)) {
    return {
      site: defaultSite,
      navigation: defaultNavigation,
      footerLinks: defaultFooterLinks,
      socials: defaultSocials,
    }
  }

  const candidateSite = isRecord(value.site) ? value.site : defaultSite
  const candidateAddress = isRecord(candidateSite.address)
    ? candidateSite.address
    : defaultSite.address

  return {
    site: {
      name: typeof candidateSite.name === 'string' ? candidateSite.name : defaultSite.name,
      shortName:
        typeof candidateSite.shortName === 'string'
          ? candidateSite.shortName
          : defaultSite.shortName,
      tagline:
        typeof candidateSite.tagline === 'string' ? candidateSite.tagline : defaultSite.tagline,
      description:
        typeof candidateSite.description === 'string'
          ? candidateSite.description
          : defaultSite.description,
      footerDescription:
        typeof candidateSite.footerDescription === 'string'
          ? candidateSite.footerDescription
          : defaultSite.footerDescription,
      founded:
        typeof candidateSite.founded === 'number' ? candidateSite.founded : defaultSite.founded,
      location:
        typeof candidateSite.location === 'string' ? candidateSite.location : defaultSite.location,
      logo: typeof candidateSite.logo === 'string' ? candidateSite.logo : defaultSite.logo,
      heroImage:
        typeof candidateSite.heroImage === 'string'
          ? candidateSite.heroImage
          : defaultSite.heroImage,
      address: {
        street:
          typeof candidateAddress.street === 'string'
            ? candidateAddress.street
            : defaultSite.address.street,
        postalCode:
          typeof candidateAddress.postalCode === 'string'
            ? candidateAddress.postalCode
            : defaultSite.address.postalCode,
        city:
          typeof candidateAddress.city === 'string'
            ? candidateAddress.city
            : defaultSite.address.city,
        country:
          typeof candidateAddress.country === 'string'
            ? candidateAddress.country
            : defaultSite.address.country,
        formatted:
          typeof candidateAddress.formatted === 'string'
            ? candidateAddress.formatted
            : defaultSite.address.formatted,
      },
    },
    navigation: Array.isArray(value.navigation)
      ? (value.navigation as NavItem[])
      : defaultNavigation,
    footerLinks: Array.isArray(value.footerLinks)
      ? (value.footerLinks as NavItem[])
      : defaultFooterLinks,
    socials: Array.isArray(value.socials) ? (value.socials as SocialLink[]) : defaultSocials,
  }
}

export function useCmsGlobals() {
  const requestFetch = useRequestFetch()

  return useAsyncData<CmsGlobals>('cms-globals', async () => {
    const response = await requestFetch<unknown>('/api/cms/globals')
    return sanitizeGlobals(response)
  })
}
