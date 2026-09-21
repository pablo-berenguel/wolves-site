interface PageSeoOptions {
  title: string
  description: string
  path?: string
  image?: string
  type?: 'website' | 'article'
  noindex?: boolean
}

export function usePageSeo(options: PageSeoOptions) {
  const route = useRoute()
  const config = useRuntimeConfig()
  const baseUrl = config.public.siteUrl.replace(/\/$/, '')
  const path = options.path ?? route.path
  const canonical = `${baseUrl}${path === '/' ? '' : path}`
  const imagePath = options.image || '/og-charte.png'
  const image = /^https?:\/\//.test(imagePath) ? imagePath : `${baseUrl}${imagePath}`
  const fullTitle = options.title.includes('Wolves')
    ? options.title
    : `${options.title} · Wolves Toulouse`

  useSeoMeta({
    title: fullTitle,
    description: options.description,
    ogTitle: fullTitle,
    ogDescription: options.description,
    ogType: options.type || 'website',
    ogLocale: 'fr_FR',
    ogSiteName: 'Wolves Toulouse Cheerleading',
    ogUrl: canonical,
    ogImage: image,
    ogImageAlt: 'Wolves Toulouse Cheerleading — The Wolves are on the mat',
    twitterCard: 'summary_large_image',
    twitterTitle: fullTitle,
    twitterDescription: options.description,
    twitterImage: image,
    robots: options.noindex ? 'noindex, nofollow' : 'index, follow',
  })

  useHead({
    link: [{ rel: 'canonical', href: canonical }],
  })

  return {
    canonical,
    image,
  }
}
