import { toValue, type MaybeRefOrGetter } from 'vue'
import type { CmsPage } from '#shared/cms/types'
import { sanitizeCmsPage } from '#shared/cms/sanitize'

export const CMS_PAGE_ENDPOINT = '/api/cms/pages/by-path'

export function normalizeCmsPagePath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0] || '/'
  if (!pathname.startsWith('/')) return `/${pathname}`
  return pathname === '/' ? pathname : pathname.replace(/\/+$/, '')
}

function parseCmsPageResponse(response: unknown): CmsPage {
  const result = sanitizeCmsPage(response)

  if (!result.value || !result.success) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Le contenu de cette page est invalide.',
      data: { issues: result.issues },
    })
  }

  return result.value
}

export async function fetchCmsPage(path: string): Promise<CmsPage> {
  const normalizedPath = normalizeCmsPagePath(path)
  const response = await $fetch<unknown>(CMS_PAGE_ENDPOINT, {
    query: { path: normalizedPath },
  })

  return parseCmsPageResponse(response)
}

export function useCmsPage(pagePath?: MaybeRefOrGetter<string | undefined>) {
  const route = useRoute()
  const requestFetch = useRequestFetch()
  const path = computed(() => normalizeCmsPagePath(toValue(pagePath) || route.path))

  return useAsyncData<CmsPage>(
    `cms-page:${path.value}`,
    async () => {
      const response = await requestFetch<unknown>(CMS_PAGE_ENDPOINT, {
        query: { path: path.value },
      })
      return parseCmsPageResponse(response)
    },
    { watch: [path] },
  )
}
