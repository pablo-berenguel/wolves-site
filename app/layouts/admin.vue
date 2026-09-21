<script setup lang="ts">
import type { TrainingAnnouncementAccess } from '#shared/types/training-announcements'
import type { TeamStatisticsAccess } from '#shared/types/team-statistics'

interface CmsAdminSessionResponse {
  user: {
    role: 'editor' | 'admin' | 'super_admin'
  }
}

const { loggedIn, user, fetch: refreshSession } = useUserSession()
const trainingAccess = useState<TrainingAnnouncementAccess | null>(
  'training-announcements-admin-access',
  () => null,
)
const statisticsAccess = useState<TeamStatisticsAccess | null>(
  'team-statistics-admin-access',
  () => null,
)

const { data: cmsSession } = await useFetch<CmsAdminSessionResponse>('/api/admin/session', {
  key: 'admin-shell-cms-session',
})

const requestFetch = useRequestFetch()
let navigationRequests: AbortController | undefined
const navigationPending = ref(false)

onMounted(async () => {
  if (!loggedIn.value) return
  const controller = new AbortController()
  navigationRequests = controller
  navigationPending.value = trainingAccess.value === null || statisticsAccess.value === null
  // These permissions only decide which navigation links to display. Each
  // destination's middleware and API still authorize every operation.
  // Run them together, after rendering, so Discord cannot hold up the CMS shell.
  await Promise.allSettled([
    trainingAccess.value === null
      ? requestFetch<TrainingAnnouncementAccess>('/api/admin/training-announcements/access', {
          signal: controller.signal,
          retry: 0,
          timeout: 30_000,
        }).then((access) => {
          if (!controller.signal.aborted && loggedIn.value) trainingAccess.value = access
        })
      : undefined,
    statisticsAccess.value === null
      ? requestFetch<TeamStatisticsAccess>('/api/admin/team-statistics/access', {
          signal: controller.signal,
          retry: 0,
          timeout: 30_000,
        }).then((access) => {
          if (!controller.signal.aborted && loggedIn.value) statisticsAccess.value = access
        })
      : undefined,
  ])
  if (!controller.signal.aborted) navigationPending.value = false
})
onBeforeUnmount(() => navigationRequests?.abort())

const cmsRoleRank = computed(() => {
  const ranks = { editor: 1, admin: 2, super_admin: 3 } as const
  const role = cmsSession.value?.user.role

  return role ? ranks[role] : 0
})
const canEditPages = computed(() => cmsRoleRank.value >= 1)
const canManageSettings = computed(() => cmsRoleRank.value >= 2)
const canManageUsers = computed(() => cmsRoleRank.value >= 3)
const canManageAnnouncements = computed(() => trainingAccess.value?.canManage === true)
const canViewStatistics = computed(() => statisticsAccess.value?.canAccess === true)
const showAdminSession = computed(
  () =>
    loggedIn.value || canEditPages.value || canManageAnnouncements.value || canViewStatistics.value,
)
const adminHome = computed(() =>
  canEditPages.value
    ? '/admin'
    : canManageAnnouncements.value
      ? '/admin/annonces'
      : '/admin/statistiques',
)
const accountLabel = computed(
  () => user.value?.displayName || user.value?.username || 'Compte Discord',
)

async function logout() {
  navigationRequests?.abort()
  navigationPending.value = false
  await $fetch('/auth/logout', { method: 'POST' })
  trainingAccess.value = null
  statisticsAccess.value = null
  await clearNuxtData('admin-shell-cms-session')
  clearNuxtData((key) => key.startsWith('admin-team-statistics'))
  await refreshSession()
  await navigateTo('/admin/login')
}
</script>

<template>
  <div class="admin-shell">
    <a class="admin-shell__skip" href="#admin-content">Aller au contenu principal</a>
    <header class="admin-shell__header">
      <NuxtLink class="admin-shell__brand" :to="adminHome">Wolves Admin</NuxtLink>
      <nav
        v-if="showAdminSession"
        class="admin-shell__nav"
        aria-label="Navigation de l’administration"
      >
        <NuxtLink v-if="canEditPages" to="/admin">Pages</NuxtLink>
        <NuxtLink v-if="canManageAnnouncements" to="/admin/annonces">Annonces</NuxtLink>
        <NuxtLink v-if="canManageAnnouncements" to="/admin/evenements">Événements</NuxtLink>
        <NuxtLink v-if="canViewStatistics" to="/admin/statistiques">Statistiques</NuxtLink>
        <NuxtLink v-if="canManageSettings" to="/admin/settings">Réglages</NuxtLink>
        <NuxtLink v-if="canManageUsers" to="/admin/users">Utilisateurs</NuxtLink>
        <span v-if="navigationPending" class="admin-shell__access-status" role="status">
          Vérification des accès…
        </span>
        <a href="/" target="_blank" rel="noopener noreferrer">Voir le site ↗</a>
      </nav>
      <div v-if="showAdminSession" class="admin-shell__account">
        <span>{{ accountLabel }}</span>
        <button type="button" class="admin-link-button" @click="logout">Déconnexion</button>
      </div>
    </header>
    <main id="admin-content" class="admin-shell__main" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  --loading-accent: var(--indigo);
  min-height: 100vh;
  color: #17214f;
  background: #f3f5fb;
}

.admin-shell__skip {
  position: fixed;
  z-index: 100;
  top: 0.5rem;
  left: 0.5rem;
  padding: 0.7rem 0.9rem;
  color: white;
  border-radius: 0.45rem;
  background: #17214f;
  transform: translateY(-150%);
}

.admin-shell__skip:focus {
  transform: translateY(0);
}

.admin-shell__header {
  position: sticky;
  z-index: 20;
  top: 0;
  display: flex;
  align-items: center;
  gap: 2rem;
  min-height: 4.5rem;
  padding: 0.75rem clamp(1rem, 3vw, 2.5rem);
  border-bottom: 1px solid #dfe3f0;
  background: rgb(255 255 255 / 96%);
  backdrop-filter: blur(14px);
}

.admin-shell__brand {
  color: #17214f;
  font-size: 1.05rem;
  font-weight: 800;
  text-decoration: none;
}

.admin-shell__nav {
  display: flex;
  flex: 1;
  gap: 1.25rem;
  min-width: 0;
  flex-wrap: wrap;
}

.admin-shell__nav a,
.admin-link-button {
  border: 0;
  color: #505b80;
  background: none;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.admin-shell__nav a.router-link-active {
  color: #25368c;
}

.admin-shell__access-status {
  color: #505b80;
  font-size: 0.8rem;
}

.admin-shell__account {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}

.admin-shell__main {
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: clamp(1.25rem, 3vw, 3rem);
}

@media (max-width: 760px) {
  .admin-shell__header {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
  }

  .admin-shell__nav {
    order: 3;
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 0.35rem;
  }

  .admin-shell__nav a {
    flex-shrink: 0;
  }

  .admin-shell__account span {
    display: none;
  }
}
</style>
