import { getPublishedPageByPath, listCmsPages } from '../utils/cms/repository'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl).replace(/\/$/, '')
  const pages = listCmsPages().flatMap((summary) => {
    if (!summary.publishedRevisionId) return []
    const page = getPublishedPageByPath(summary.path)
    return page && !page.seo.noindex ? [page] : []
  })

  const urls = pages
    .map(
      (page) => `  <url>
    <loc>${escapeXml(`${siteUrl}${page.path === '/' ? '' : page.path}`)}</loc>
    <lastmod>${escapeXml((page.publishedAt || page.updatedAt).slice(0, 10))}</lastmod>
  </url>`,
    )
    .join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=0, must-revalidate')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
})
