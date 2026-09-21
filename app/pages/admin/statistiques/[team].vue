<script setup lang="ts">
import type { TeamStatisticsDetail, TeamStatisticsMember } from '#shared/types/team-statistics'
import { TEAM_STATISTICS_TEAMS } from '#shared/types/team-statistics'

definePageMeta({ layout: 'admin', middleware: 'team-statistics-admin' })
const route = useRoute()
const { query, selectYear } = useTeamStatisticsYear()
const { loggedIn } = useUserSession()
const { data, error, status, refresh, clear } = await useFetch<TeamStatisticsDetail>(
  () => `/api/admin/team-statistics/${encodeURIComponent(String(route.params.team))}`,
  {
    query,
    key: `admin-team-statistics-detail-${useId()}`,
    server: false,
    lazy: true,
    retry: 0,
    timeout: 60_000,
    getCachedData: () => undefined,
  },
)
const teamLabel = computed(
  () =>
    Object.entries(TEAM_STATISTICS_TEAMS).find(([key]) => key === route.params.team)?.[1] ??
    'Statistiques de l’équipe',
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
      Boolean(
        data.value &&
        (selectedYear.value !== data.value.year || data.value.team.key !== route.params.team),
      )),
)
useSeoMeta({
  title: () => `${teamLabel.value} · Statistiques Wolves`,
  robots: 'noindex, nofollow',
})

const search = ref('')
const sort = ref<'name' | 'registrations' | 'cancellations'>('name')
const hasHistory = computed(() => data.value?.historyStatus === 'available')
const members = computed(() => {
  const term = normalize(search.value.trim())
  return (data.value?.members ?? [])
    .filter((member) => normalize(`${member.displayName} ${member.username}`).includes(term))
    .toSorted((left, right) => {
      if (sort.value !== 'name') {
        const difference = right[sort.value] - left[sort.value]
        if (difference) return difference
      }
      return memberName(left).localeCompare(memberName(right), 'fr')
    })
})
const maximumMonth = computed(() =>
  Math.max(1, ...(data.value?.monthly.map((month) => month.registrations) ?? [])),
)
const numberFormatter = new Intl.NumberFormat('fr-FR')
const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
  timeZone: 'Europe/Paris',
})
const errorStatus = computed(() => error.value?.statusCode ?? error.value?.status)

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
}

function memberName(member: TeamStatisticsMember) {
  return member.displayName || member.username
}

function count(value: number) {
  return hasHistory.value ? numberFormatter.format(value) : '—'
}

function monthLabel(value: string) {
  const date = new Date(`${value}-15T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : monthFormatter.format(date)
}

watch(loggedIn, (authenticated) => {
  if (!authenticated) clear()
})
onBeforeUnmount(() => clear())
</script>

<template>
  <AdminTeamStatisticsFrame
    :title="teamLabel"
    description="L’effectif actuel et son historique d’inscription, accessibles aux coachs de l’équipe, aux Head Coaches et aux administrateurs."
    :years="data?.availableYears ?? []"
    :year="selectedYear"
    :current-year="data?.currentYear ?? null"
    :pending="loading"
    :updated-at="loading || error ? null : data?.sourceUpdatedAt"
    detail
    @year-change="selectYear"
  >
    <div v-if="!loggedIn" class="stats-detail__panel stats-detail__state">
      <h2>Connecte ton compte Discord</h2>
      <p>Une connexion est nécessaire pour consulter les membres de cette équipe.</p>
      <NuxtLink to="/admin/login?redirect=/admin/statistiques">Se connecter avec Discord</NuxtLink>
    </div>
    <div v-else-if="error" class="stats-detail__panel stats-detail__state" role="alert">
      <h2>
        {{
          errorStatus === 403
            ? 'Ce détail n’est pas accessible avec ton rôle'
            : 'Le détail de l’équipe est indisponible'
        }}
      </h2>
      <p v-if="errorStatus === 403">
        Seuls les coachs de cette équipe, les Head Coaches et les administrateurs peuvent consulter
        ses membres.
      </p>
      <p v-else>Vérifie l’équipe et l’année demandées, ou réessaie dans quelques instants.</p>
      <button
        v-if="errorStatus !== 403"
        class="stats-detail__retry"
        type="button"
        :disabled="status === 'pending'"
        @click="refresh()"
      >
        {{ status === 'pending' ? 'Nouvelle tentative…' : 'Réessayer' }}
      </button>
    </div>
    <AppLoadingState
      v-else-if="loading"
      :label="`Chargement de ${teamLabel}…`"
      description="Les membres et leurs inscriptions s’afficheront après vérification de ton accès."
      variant="detail"
      :count="4"
    />
    <template v-else-if="data">
      <div
        v-if="!data.team.configured || !hasHistory"
        class="stats-detail__panel stats-detail__state"
        role="status"
      >
        <h2>
          {{
            !data.team.configured
              ? 'Rôle Discord à configurer'
              : `Historique non disponible pour ${data.year}`
          }}
        </h2>
        <p>
          {{
            !data.team.configured
              ? 'Aucun rôle n’est associé à cette équipe dans la configuration BigBadBot.'
              : 'Les tirets signalent des données non enregistrées. Ils ne signifient pas que les membres n’ont pas participé : l’effectif affiché est celui d’aujourd’hui.'
          }}
        </p>
      </div>

      <template v-if="data.team.configured">
        <dl class="stats-detail__metrics">
          <div>
            <dt>Effectif actuel</dt>
            <dd>{{ data.team.memberCount }}</dd>
            <span>{{
              hasHistory
                ? `${data.team.registeredMemberCount} avec une inscription en ${data.year}`
                : 'Rôles Discord actuels'
            }}</span>
          </div>
          <div>
            <dt>Inscriptions</dt>
            <dd>{{ count(data.team.registrations) }}</dd>
            <span>Encore actives dans l’historique</span>
          </div>
          <div>
            <dt>Annulations</dt>
            <dd>{{ count(data.team.cancellations) }}</dd>
            <span>Dont {{ count(data.team.lateCancellations) }} à moins de 24 h</span>
          </div>
          <div>
            <dt>Semaines actives</dt>
            <dd>{{ count(data.team.activeWeeks) }}</dd>
            <span>Avec au moins une inscription</span>
          </div>
        </dl>

        <section
          v-if="hasHistory && data.monthly.length"
          class="stats-detail__panel"
          aria-labelledby="monthly-title"
        >
          <div class="stats-detail__section-heading">
            <div>
              <h2 id="monthly-title">Au fil de l’année</h2>
              <p>Inscriptions conservées, réparties par mois.</p>
            </div>
            <span class="stats-detail__badge">{{ data.year }}</span>
          </div>
          <ol class="stats-detail__months">
            <li v-for="month in data.monthly" :key="month.month">
              <span>{{ monthLabel(month.month) }}</span>
              <div class="stats-detail__month-track" aria-hidden="true">
                <span :style="{ width: `${(month.registrations / maximumMonth) * 100}%` }" />
              </div>
              <strong>{{ month.registrations }}<span class="sr-only"> inscriptions</span></strong>
            </li>
          </ol>
        </section>

        <section class="stats-detail__panel stats-detail__members" aria-labelledby="members-title">
          <div class="stats-detail__section-heading">
            <div>
              <h2 id="members-title">Les membres de l’équipe</h2>
              <p>Nom affiché sur Discord et inscriptions de l’année sélectionnée.</p>
            </div>
            <span class="stats-detail__badge">{{ data.team.memberCount }} membres</span>
          </div>
          <div class="stats-detail__filters">
            <label
              ><span>Rechercher un membre</span
              ><input v-model="search" type="search" placeholder="Nom ou pseudo Discord"
            /></label>
            <label
              ><span>Trier par</span
              ><select v-model="sort">
                <option value="name">Nom · A → Z</option>
                <option value="registrations">Plus d’inscriptions</option>
                <option value="cancellations">Plus d’annulations</option>
              </select></label
            >
          </div>

          <p class="stats-detail__result-count" role="status">
            {{ members.length }} membre{{ members.length === 1 ? '' : 's' }} affiché{{
              members.length === 1 ? '' : 's'
            }}
          </p>
          <div
            v-if="members.length"
            class="stats-detail__table-scroll"
            tabindex="0"
            role="region"
            aria-label="Statistiques des membres, tableau à défilement horizontal"
          >
            <table>
              <caption class="sr-only">
                Inscriptions des membres actuels de
                {{
                  data.team.label
                }}
                en
                {{
                  data.year
                }}. Les annulations peuvent être partielles dans l’historique ancien.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Membre</th>
                  <th scope="col">Inscriptions</th>
                  <th scope="col">Open Gym</th>
                  <th scope="col">Ateliers</th>
                  <th scope="col">Autres</th>
                  <th scope="col">Annulations</th>
                  <th scope="col">Dont &lt; 24 h</th>
                  <th scope="col">Semaines actives</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in members" :key="member.key">
                  <th scope="row">
                    <strong>{{ memberName(member) }}</strong
                    ><span v-if="member.username">@{{ member.username }}</span>
                  </th>
                  <td class="stats-detail__registration-count">
                    {{ count(member.registrations) }}
                  </td>
                  <td>{{ count(member.openGym) }}</td>
                  <td>{{ count(member.workshop) }}</td>
                  <td>{{ count(member.other) }}</td>
                  <td>{{ count(member.cancellations) }}</td>
                  <td>{{ count(member.lateCancellations) }}</td>
                  <td>{{ count(member.activeWeeks) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="stats-detail__empty">
            {{
              search
                ? 'Aucun membre ne correspond à cette recherche.'
                : 'Aucun membre ne porte actuellement le rôle Discord de cette équipe.'
            }}
          </p>
          <p class="stats-detail__footnote">
            Les anciennes annulations et leurs heures ne sont pas toujours conservées. Un nom
            affiché peut être un pseudonyme ; aucune identité n’est déduite.
          </p>
        </section>
      </template>
    </template>
  </AdminTeamStatisticsFrame>
</template>

<style scoped>
.stats-detail__panel {
  min-width: 0;
  padding: clamp(1rem, 2.5vw, 1.5rem);
  border: 1px solid var(--stats-border);
  border-radius: var(--radius-lg);
  background: white;
}
.stats-detail__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.stats-detail__metrics > div {
  min-width: 0;
  padding: 1.2rem;
  border: 1px solid var(--stats-border);
  border-radius: var(--radius-lg);
  background: white;
}
.stats-detail__metrics dt {
  color: var(--stats-muted);
  font-size: 0.85rem;
  font-weight: 700;
}
.stats-detail__metrics dd {
  margin: 0.45rem 0;
  color: var(--indigo);
  font-size: 2.35rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.stats-detail__metrics span {
  color: var(--stats-muted);
  font-size: 0.75rem;
}
.stats-detail__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-bottom: 1.4rem;
}
.stats-detail__section-heading h2,
.stats-detail__state h2 {
  font-size: 1.1rem;
  font-weight: 800;
}
.stats-detail__section-heading p,
.stats-detail__state p {
  margin-top: 0.35rem;
  color: var(--stats-muted);
  font-size: 0.85rem;
}
.stats-detail__badge {
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius);
  color: var(--indigo);
  background: #edf0fc;
  font-size: 0.8rem;
  font-weight: 800;
}
.stats-detail__months {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem 2rem;
  padding: 0;
  list-style: none;
}
.stats-detail__months li {
  display: grid;
  grid-template-columns: 2.7rem 1fr 2rem;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}
.stats-detail__months li > span {
  color: var(--stats-muted);
}
.stats-detail__months strong {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.stats-detail__month-track {
  height: 0.45rem;
  overflow: hidden;
  border-radius: 1rem;
  background: #edf0fc;
}
.stats-detail__month-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--indigo);
}
.stats-detail__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.stats-detail__filters label {
  display: grid;
  flex: 1 1 14rem;
  min-width: 0;
  gap: 0.35rem;
}
.stats-detail__filters label:first-child {
  flex-grow: 2;
}
.stats-detail__filters label > span {
  font-size: 0.8rem;
  font-weight: 700;
}
.stats-detail__filters input,
.stats-detail__filters select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--stats-border);
  border-radius: var(--radius);
  color: var(--ink);
  background: white;
  font: inherit;
  font-size: 0.9rem;
}
.stats-detail__result-count {
  margin: 1rem 0 0.7rem;
  color: var(--stats-muted);
  font-size: 0.8rem;
}
.stats-detail__table-scroll {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--stats-border);
  border-radius: var(--radius);
}
.stats-detail__table-scroll table {
  width: 100%;
  min-width: 49rem;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.stats-detail__table-scroll th,
.stats-detail__table-scroll td {
  padding: 0.85rem 0.8rem;
  border-bottom: 1px solid var(--stats-border);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.stats-detail__table-scroll thead th {
  color: var(--stats-muted);
  background: #f7f8fc;
  font-size: 0.72rem;
  font-weight: 700;
}
.stats-detail__table-scroll th:first-child {
  min-width: 12rem;
  text-align: left;
}
.stats-detail__table-scroll tbody th {
  max-width: 19rem;
  overflow-wrap: anywhere;
}
.stats-detail__table-scroll tbody th strong {
  display: block;
  font-weight: 800;
}
.stats-detail__table-scroll tbody th span {
  display: block;
  margin-top: 0.15rem;
  color: var(--stats-muted);
  font-size: 0.75rem;
  font-weight: 400;
}
.stats-detail__table-scroll tbody tr:last-child > * {
  border-bottom: 0;
}
.stats-detail__table-scroll tbody tr:hover {
  background: #f7f8fc;
}
.stats-detail__registration-count {
  color: var(--indigo);
  font-weight: 800;
}
.stats-detail__footnote {
  margin-top: 1rem;
  color: var(--stats-muted);
  font-size: 0.75rem;
}
.stats-detail__empty {
  padding: 1.5rem 0;
  color: var(--stats-muted);
}
.stats-detail__retry {
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
@media (max-width: 1000px) {
  .stats-detail__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stats-detail__months {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 500px) {
  .stats-detail__metrics {
    gap: 0.65rem;
  }
  .stats-detail__metrics > div {
    padding: 0.85rem;
  }
  .stats-detail__metrics dd {
    font-size: 2rem;
  }
  .stats-detail__months {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
