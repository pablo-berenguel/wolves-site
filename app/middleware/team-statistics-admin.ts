import type { TeamStatisticsAccess } from '#shared/types/team-statistics'

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const candidate = error as {
    status?: unknown
    statusCode?: unknown
    response?: { status?: unknown }
  }
  const status = candidate.statusCode ?? candidate.status ?? candidate.response?.status
  return typeof status === 'number' ? status : null
}

export default defineNuxtRouteMiddleware(async (to) => {
  const access = useState<TeamStatisticsAccess | null>('team-statistics-admin-access', () => null)
  const nuxtApp = useNuxtApp()
  // Reuse only this request's successful SSR check during hydration. Every
  // later navigation and every data API call still rechecks Discord permissions.
  if (
    import.meta.client &&
    nuxtApp.isHydrating &&
    nuxtApp.payload.serverRendered &&
    access.value?.canAccess
  )
    return

  try {
    access.value = await useRequestFetch()<TeamStatisticsAccess>(
      '/api/admin/team-statistics/access',
    )
    if (!access.value.canAccess) {
      return abortNavigation(
        createError({
          statusCode: 403,
          statusMessage: 'Accès réservé aux coachs et administrateurs.',
        }),
      )
    }
    if (to.params.team && !access.value.detailTeamKeys.some((team) => team === to.params.team)) {
      return abortNavigation(
        createError({
          statusCode: 403,
          statusMessage:
            'Le détail est réservé aux coachs de cette équipe, aux Head Coaches et aux administrateurs.',
        }),
      )
    }
  } catch (error) {
    access.value = null
    if (getErrorStatus(error) === 401) {
      return navigateTo('/admin/login?redirect=/admin/statistiques', { replace: true })
    }
    if (getErrorStatus(error) === 403) {
      return abortNavigation(
        createError({
          statusCode: 403,
          statusMessage: 'Accès réservé aux coachs et administrateurs.',
        }),
      )
    }
    throw error
  }
})
