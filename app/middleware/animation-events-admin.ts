import type { TrainingAnnouncementAccess } from '#shared/types/training-announcements'

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

export default defineNuxtRouteMiddleware(async () => {
  const access = useState<TrainingAnnouncementAccess | null>(
    'training-announcements-admin-access',
    () => null,
  )
  const nuxtApp = useNuxtApp()
  // SSR already authorized this page; don't repeat that check during hydration.
  // Subsequent navigations and API operations always recheck permissions.
  if (
    import.meta.client &&
    nuxtApp.isHydrating &&
    nuxtApp.payload.serverRendered &&
    access.value?.canManage
  )
    return

  try {
    access.value = await useRequestFetch()<TrainingAnnouncementAccess>(
      '/api/admin/animation-events/access',
    )
    if (!access.value.canManage) {
      return abortNavigation(
        createError({ statusCode: 403, statusMessage: 'Accès réservé aux Head Coaches.' }),
      )
    }
  } catch (error) {
    const status = getErrorStatus(error)
    if (status === 401) return navigateTo('/admin/login', { replace: true })
    if (status === 403) {
      return abortNavigation(
        createError({ statusCode: 403, statusMessage: 'Accès réservé aux Head Coaches.' }),
      )
    }
    throw error
  }
})
