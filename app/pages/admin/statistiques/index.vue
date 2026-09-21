<script setup lang="ts">
import type { TeamStatisticsOverview } from '#shared/types/team-statistics'

definePageMeta({ layout: 'admin', middleware: 'team-statistics-admin' })
useSeoMeta({ title: 'Statistiques par équipe · Wolves Admin', robots: 'noindex, nofollow' })

const { query, selectYear } = useTeamStatisticsYear()
const { loggedIn } = useUserSession()
const { data, error, status, refresh, clear } = await useFetch<TeamStatisticsOverview>(
  '/api/admin/team-statistics',
  {
    query,
    key: `admin-team-statistics-overview-${useId()}`,
    server: false,
    lazy: true,
    retry: 0,
    timeout: 60_000,
    // Each visit must recheck access; private statistics never reuse a navigation cache.
    getCachedData: () => undefined,
  },
)
const selectedYear = computed(() => {
  const year = Number(query.value.year ?? data.value?.currentYear)
  return Number.isInteger(year) ? year : null
})
const loading = computed(
  () =>
    loggedIn.value &&
    !error.value &&
    (status.value === 'idle' ||
      status.value === 'pending' ||
      Boolean(data.value && selectedYear.value !== data.value.year)),
)
const hasHistory = computed(() => data.value?.historyStatus === 'available')
const numberFormatter = new Intl.NumberFormat('fr-FR')

function count(value: number, configured: boolean) {
  return hasHistory.value && configured ? numberFormatter.format(value) : '—'
}

watch(loggedIn, (authenticated) => {
  if (!authenticated) clear()
})
onBeforeUnmount(() => clear())
</script>

<template>
  <AdminTeamStatisticsFrame
    title="Statistiques par équipe"
    description="Une vue commune pour les coachs, puis le détail des membres des équipes que tu encadres."
    :years="data?.availableYears ?? []"
    :year="selectedYear"
    :current-year="data?.currentYear ?? null"
    :pending="loading"
    :updated-at="loading || error ? null : data?.sourceUpdatedAt"
    @year-change="selectYear"
  >
    <div v-if="!loggedIn" class="stats-overview__state">
      <h2>Connecte ton compte Discord</h2>
      <p>Une connexion est nécessaire pour consulter les statistiques des équipes.</p>
      <NuxtLink to="/admin/login?redirect=/admin/statistiques">Se connecter avec Discord</NuxtLink>
    </div>
    <div v-else-if="error" class="stats-overview__state" role="alert">
      <h2>Les statistiques ne sont pas disponibles</h2>
      <p>Vérifie l’année demandée ou réessaie dans quelques instants.</p>
      <button type="button" :disabled="status === 'pending'" @click="refresh()">
        {{ status === 'pending' ? 'Nouvelle tentative…' : 'Réessayer' }}
      </button>
    </div>
    <AppLoadingState
      v-else-if="loading"
      label="Chargement des statistiques des équipes…"
      description="BigBadBot vérifie tes accès et rassemble les inscriptions de l’année."
      variant="cards"
      :count="6"
    />
    <template v-else-if="data">
      <div v-if="!hasHistory" class="stats-overview__state" role="status">
        <h2>Aucun historique conservé pour {{ data.year }}</h2>
        <p>
          BigBadBot n’a pas de données pour cette année. Cela ne signifie pas qu’il n’y a eu aucune
          activité : les effectifs actuels restent consultables, mais les statistiques sont
          inconnues.
        </p>
      </div>

      <div class="stats-overview__grid">
        <article v-for="team in data.teams" :key="team.key" class="stats-overview__card">
          <header class="stats-overview__card-header">
            <span class="stats-overview__monogram" aria-hidden="true">
              {{ team.label.slice(0, 2).toLocaleUpperCase('fr-FR') }}
            </span>
            <div>
              <h2>{{ team.label }}</h2>
              <p v-if="team.configured">
                {{ team.memberCount }} membre{{ team.memberCount === 1 ? '' : 's' }} dans l’effectif
                actuel
              </p>
              <p v-else>Rôle Discord à configurer</p>
            </div>
          </header>

          <dl class="stats-overview__metrics">
            <div class="stats-overview__primary-metric">
              <dt>Inscriptions</dt>
              <dd>{{ count(team.registrations, team.configured) }}</dd>
            </div>
            <div>
              <dt>Membres inscrits</dt>
              <dd>{{ count(team.registeredMemberCount, team.configured) }}</dd>
            </div>
            <div>
              <dt>Annulations</dt>
              <dd>{{ count(team.cancellations, team.configured) }}</dd>
            </div>
          </dl>

          <NuxtLink
            v-if="team.configured && team.canViewDetails"
            class="stats-overview__detail"
            :to="{ path: `/admin/statistiques/${team.key}`, query: { year: data.year } }"
            :aria-label="`Voir les membres et statistiques de ${team.label} en ${data.year}`"
          >
            Voir l’équipe <span aria-hidden="true">→</span>
          </NuxtLink>
          <p v-else class="stats-overview__restricted">
            {{
              team.configured
                ? 'Détail réservé aux coachs de cette équipe.'
                : 'Statistiques indisponibles sans rôle associé.'
            }}
          </p>
        </article>
      </div>
      <p class="stats-overview__footnote">
        Une personne peut appartenir à plusieurs équipes. Les chiffres des équipes ne doivent donc
        pas être additionnés pour obtenir un total du club.
      </p>
    </template>
  </AdminTeamStatisticsFrame>
</template>

<style scoped>
.stats-overview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1.1rem;
}

.stats-overview__card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: clamp(1.1rem, 2vw, 1.5rem);
  border: 1px solid var(--stats-border);
  border-radius: var(--radius-lg);
  background: white;
}

.stats-overview__card-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.stats-overview__monogram {
  display: grid;
  flex: 0 0 2.8rem;
  height: 2.8rem;
  place-items: center;
  border-radius: var(--radius);
  color: white;
  background: var(--indigo);
  font-weight: 800;
}

.stats-overview__card h2 {
  font-size: 1.2rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.stats-overview__card-header p {
  margin-top: 0.2rem;
  color: var(--stats-muted);
  font-size: 0.75rem;
}

.stats-overview__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
  margin: 1.4rem 0;
}

.stats-overview__metrics dt {
  color: var(--stats-muted);
  font-size: 0.8rem;
}

.stats-overview__metrics dd {
  margin-top: 0.2rem;
  font-size: 1.4rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.stats-overview__primary-metric {
  grid-column: 1 / -1;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--stats-border);
}

.stats-overview__primary-metric dd {
  color: var(--indigo);
  font-size: 2.7rem;
  line-height: 1.1;
}

.stats-overview__detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.75rem;
  margin-top: auto;
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius);
  color: var(--indigo);
  background: #edf0fc;
  font-size: 0.85rem;
  font-weight: 800;
  text-decoration: none;
}

.stats-overview__detail:hover {
  background: #e1e6fa;
}

.stats-overview__restricted {
  margin-top: auto;
  padding-top: 0.6rem;
  color: var(--stats-muted);
  font-size: 0.8rem;
}

.stats-overview__state {
  padding: 1.5rem;
  border: 1px solid var(--stats-border);
  border-radius: var(--radius-lg);
  background: white;
}

.stats-overview__state h2 {
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  font-weight: 800;
}

.stats-overview__state p,
.stats-overview__footnote {
  color: var(--stats-muted);
  font-size: 0.85rem;
}

.stats-overview__state button {
  min-height: 2.75rem;
  margin-top: 1rem;
  padding: 0.6rem 1rem;
  border: 0;
  border-radius: var(--radius);
  color: white;
  background: var(--indigo);
  font: inherit;
  cursor: pointer;
}
</style>
