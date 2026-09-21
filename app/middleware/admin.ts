import type { TrainingAnnouncementAccess } from '#shared/types/training-announcements'
import type { TeamStatisticsAccess } from '#shared/types/team-statistics'

interface AdminSessionResponse {
  user: {
    id: string
  }
}

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
  if (!to.path.startsWith('/admin') || to.path === '/admin/login') return

  try {
    await useRequestFetch()<AdminSessionResponse>('/api/admin/session')
  } catch (error) {
    const status = getErrorStatus(error)

    if (status === 403 && to.path === '/admin') {
      try {
        const access = await useRequestFetch()<TrainingAnnouncementAccess>(
          '/api/admin/training-announcements/access',
        )

        if (access.canManage) {
          return navigateTo('/admin/annonces', { replace: true })
        }
      } catch {
        // The dedicated announcement middleware will expose any bridge error
        // once the user explicitly opens that operational tool.
      }

      try {
        const access = await useRequestFetch()<TeamStatisticsAccess>(
          '/api/admin/team-statistics/access',
        )
        if (access.canAccess) {
          return navigateTo('/admin/statistiques', { replace: true })
        }
      } catch {
        // The statistics route reports bridge errors when opened directly.
      }
    }

    if (status === 401 || status === 403) {
      return navigateTo('/admin/login', { replace: true })
    }

    throw error
  }
})
