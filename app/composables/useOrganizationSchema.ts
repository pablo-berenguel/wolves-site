import { site, socials } from '~/data/site'
import type { CmsGlobals } from './useCmsGlobals'

export function useOrganizationSchema(globals?: Ref<CmsGlobals | null>) {
  const config = useRuntimeConfig()
  const baseUrl = config.public.siteUrl.replace(/\/$/, '')

  useHead(() => {
    const currentSite = globals?.value?.site || site
    const currentSocials = globals?.value?.socials || socials
    const logo = currentSite.logo.startsWith('http')
      ? currentSite.logo
      : `${baseUrl}${currentSite.logo}`

    return {
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'SportsOrganization',
              '@id': `${baseUrl}/#organization`,
              name: currentSite.name,
              alternateName: currentSite.shortName,
              url: baseUrl,
              logo,
              image: `${baseUrl}/og-charte.png`,
              sport: 'Cheerleading',
              foundingDate: String(currentSite.founded),
              description: currentSite.description,
              address: {
                '@type': 'PostalAddress',
                streetAddress: currentSite.address.street,
                postalCode: currentSite.address.postalCode,
                addressLocality: currentSite.address.city,
                addressCountry: 'FR',
              },
              sameAs: currentSocials.map((social) => social.url),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              '@id': `${baseUrl}/#website`,
              url: baseUrl,
              name: currentSite.name,
              inLanguage: 'fr-FR',
              publisher: {
                '@id': `${baseUrl}/#organization`,
              },
            },
          ]),
        },
      ],
    }
  })
}
