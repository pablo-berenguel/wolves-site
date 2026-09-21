<script setup lang="ts">
import { TEAM_STATISTICS_TEAMS, type TeamStatisticsTeamKey } from '#shared/types/team-statistics'
import type {
  TrainingRosterParticipant,
  TrainingRosterResponse,
} from '#shared/types/training-roster'

definePageMeta({ middleware: 'member-slot-participants' })
usePageSeo({
  title: 'Créneaux et participants',
  description: 'Les créneaux de la dernière annonce d’entraînement et leurs participants Wolves.',
  path: '/creneaux',
  noindex: true,
})

const { loggedIn } = useUserSession()
const requestedSessionKey = ref<string>()
const changingSession = ref(false)
type TeamFilterKey = TeamStatisticsTeamKey | 'unassigned' | 'unavailable'
const selectedTeams = ref<TeamFilterKey[]>([])
const participantSearch = ref('')
const participantSort = ref<'name' | 'registration'>('name')
const nameCollator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function belongsToTeam(participant: TrainingRosterParticipant, team: TeamFilterKey) {
  if (team === 'unavailable') return !participant.profileAvailable
  if (!participant.profileAvailable) return false
  if (team === 'unassigned') return participant.teamKeys.length === 0
  return participant.teamKeys.includes(team)
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim()
}
const query = computed(() =>
  requestedSessionKey.value ? { sessionKey: requestedSessionKey.value } : {},
)
const { data, error, status, refresh, clear } = await useFetch<TrainingRosterResponse>(
  '/api/member/training-roster',
  {
    key: `member-training-roster-${useId()}`,
    query,
    server: false,
    lazy: true,
    retry: 0,
    timeout: 60_000,
    // Every visit must verify the Wolves role; do not cache private participants.
    getCachedData: () => undefined,
  },
)
const loading = computed(
  () =>
    loggedIn.value &&
    !error.value &&
    (status.value === 'idle' || status.value === 'pending' || changingSession.value),
)
const activeSessionKey = computed(
  () => (loading.value ? requestedSessionKey.value : undefined) ?? data.value?.selectedSessionKey,
)
const loadingSession = computed(() =>
  data.value?.announcement?.sessions.find((session) => session.key === activeSessionKey.value),
)

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
})
const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
})
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})
const selectedSession = computed(() =>
  data.value?.announcement?.sessions.find(
    (session) => session.key === data.value?.selectedSessionKey,
  ),
)
const flyerCount = computed(
  () =>
    data.value?.participants.filter(
      (participant) => participant.profileAvailable && participant.isFlyer === true,
    ).length ?? 0,
)
const unavailableProfileCount = computed(
  () => data.value?.participants.filter((participant) => !participant.profileAvailable).length ?? 0,
)
const teamOptions = computed(() => {
  const options: { key: TeamFilterKey; label: string }[] = Object.entries(
    TEAM_STATISTICS_TEAMS,
  ).map(([key, label]) => ({ key: key as TeamStatisticsTeamKey, label }))
  options.push(
    { key: 'unassigned', label: 'Sans équipe renseignée' },
    { key: 'unavailable', label: 'Profil indisponible' },
  )
  return options
    .map((option) => ({
      ...option,
      count:
        data.value?.participants.filter((participant) => belongsToTeam(participant, option.key))
          .length ?? 0,
    }))
    .filter(
      (option) =>
        (option.key !== 'unavailable' && option.key !== 'unassigned') ||
        option.count > 0 ||
        selectedTeams.value.includes(option.key),
    )
})
const teamSelectionLabel = computed(() =>
  selectedTeams.value.length
    ? teamOptions.value
        .filter((option) => selectedTeams.value.includes(option.key))
        .map((option) => option.label)
        .join(', ')
    : 'Toutes les équipes',
)
const hasParticipantFilters = computed(
  () => selectedTeams.value.length > 0 || normalizeSearch(participantSearch.value).length > 0,
)
const visibleParticipants = computed(() => {
  const search = normalizeSearch(participantSearch.value)
  const participants = (data.value?.participants ?? []).filter((participant) => {
    const matchesTeam =
      !selectedTeams.value.length ||
      selectedTeams.value.some((team) => belongsToTeam(participant, team))
    const matchesSearch =
      !search ||
      (participant.profileAvailable &&
        normalizeSearch(`${participant.displayName} ${participant.username}`).includes(search))
    return matchesTeam && matchesSearch
  })
  if (participantSort.value === 'name') {
    participants.sort(
      (a, b) =>
        Number(b.profileAvailable) - Number(a.profileAvailable) ||
        nameCollator.compare(a.displayName || a.username, b.displayName || b.username),
    )
  }
  return participants
})
const visibleFlyerCount = computed(
  () =>
    visibleParticipants.value.filter(
      (participant) => participant.profileAvailable && participant.isFlyer === true,
    ).length,
)

function toggleTeam(key: TeamFilterKey) {
  selectedTeams.value = selectedTeams.value.includes(key)
    ? selectedTeams.value.filter((team) => team !== key)
    : [...selectedTeams.value, key]
}

function resetParticipantFilters() {
  selectedTeams.value = []
  participantSearch.value = ''
}
const selectionLabel = computed(() => {
  const labels = {
    requested: 'Créneau sélectionné',
    next: 'Prochain créneau · sélection automatique',
    ongoing: 'Créneau en cours · sélection automatique',
    latest_past: 'Dernier créneau terminé · sélection automatique',
  }
  return data.value?.selectionReason ? labels[data.value.selectionReason] : 'Participants'
})
const errorStatus = computed(() => error.value?.statusCode ?? error.value?.status)

function parseDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDay(value: string) {
  const date = parseDate(value)
  return date ? dayFormatter.format(date) : 'Date à confirmer'
}

function formatTime(value: string) {
  const date = parseDate(value)
  return date ? timeFormatter.format(date) : 'Horaire à confirmer'
}

function formatDateTime(value: string) {
  const date = parseDate(value)
  return date ? dateTimeFormatter.format(date) : 'Date à confirmer'
}

function selectSession(key: string) {
  if (loading.value || key === data.value?.selectedSessionKey) return
  changingSession.value = true
  requestedSessionKey.value = key
}

async function reloadLatest() {
  if (requestedSessionKey.value === undefined) await refresh()
  else {
    changingSession.value = true
    requestedSessionKey.value = undefined
  }
}

watch(status, (value) => {
  if (value === 'success' || value === 'error') changingSession.value = false
})
watch(loggedIn, (authenticated) => {
  if (!authenticated) clear()
})
onBeforeUnmount(() => clear())
</script>

<template>
  <div class="training-roster-page">
    <section class="training-roster-hero" aria-labelledby="training-roster-title">
      <div class="container training-roster-hero__inner">
        <div>
          <p class="eyebrow">Espace Wolves</p>
          <h1 id="training-roster-title" class="display-title">Qui vient au créneau ?</h1>
          <p class="training-roster-hero__intro">
            Retrouve les inscrits de la dernière annonce d’entraînement, leurs équipes et leur rôle
            Flyer.
          </p>
        </div>
        <span class="training-roster-hero__access">Réservé au rôle Wolves</span>
      </div>
    </section>

    <section class="section section--compact">
      <div class="container training-roster-content">
        <div class="training-roster-toolbar">
          <MemberSpaceNavigation v-if="loggedIn" />
          <button
            v-if="loggedIn"
            class="button button--ghost training-roster-refresh"
            type="button"
            :disabled="loading || status === 'pending'"
            @click="refresh()"
          >
            {{ loading || status === 'pending' ? 'Actualisation…' : 'Actualiser' }}
          </button>
        </div>

        <div v-if="errorStatus === 401 || !loggedIn" class="training-roster-state">
          <p class="eyebrow">Connexion requise</p>
          <h2>Connecte ton compte Discord</h2>
          <p>Le rôle Wolves est vérifié avant chaque affichage des participants.</p>
          <NuxtLink class="button button--primary" to="/admin/login?redirect=/creneaux"
            >Se connecter avec Discord
            <span class="button__arrow" aria-hidden="true">→</span></NuxtLink
          >
        </div>
        <div v-else-if="errorStatus === 403" class="training-roster-state" role="alert">
          <p class="eyebrow">Accès restreint</p>
          <h2>Le rôle Wolves est nécessaire</h2>
          <p>
            Ton compte doit posséder le rôle Wolves sur le serveur Discord du club et pouvoir
            consulter les annonces d’entraînement. Un historique BigBadBot ou un rôle de coach ou
            d’administrateur ne remplace pas cet accès.
          </p>
          <button
            class="button button--primary"
            type="button"
            :disabled="status === 'pending'"
            @click="refresh()"
          >
            {{ status === 'pending' ? 'Vérification en cours…' : 'Vérifier à nouveau mon accès' }}
          </button>
        </div>
        <div v-else-if="error" class="training-roster-state" role="alert">
          <p class="eyebrow">Chargement interrompu</p>
          <h2>Impossible de confirmer les participants</h2>
          <p>
            Le créneau a peut-être changé ou BigBadBot est momentanément indisponible. Recharge la
            dernière annonce pour récupérer une liste vérifiée.
          </p>
          <button
            class="button button--primary"
            type="button"
            :disabled="status === 'pending'"
            @click="reloadLatest"
          >
            {{ status === 'pending' ? 'Nouvelle tentative…' : 'Recharger la dernière annonce' }}
          </button>
        </div>
        <AppLoadingState
          v-else-if="loading && !data"
          label="Un instant, on retrouve les Wolves…"
          description="Les créneaux, les inscriptions et les rôles Discord sont en cours de vérification."
          variant="cards"
          :count="4"
        />
        <template v-else-if="data">
          <div v-if="!data.announcement" class="training-roster-state">
            <p class="eyebrow">Aucune annonce</p>
            <h2>Les prochains créneaux arrivent ici</h2>
            <p>
              Aucune annonce d’entraînement n’est disponible pour le moment. Reviens après sa
              publication par le club.
            </p>
          </div>
          <template v-else>
            <header class="training-roster-announcement">
              <div>
                <p class="eyebrow">Dernière annonce · {{ data.announcement.weekLabel }}</p>
                <h2>{{ data.announcement.title }}</h2>
              </div>
              <p>Publiée le {{ formatDateTime(data.announcement.publishedAt) }}</p>
            </header>

            <div v-if="!data.announcement.sessions.length" class="training-roster-state">
              <h2>Aucun créneau disponible dans cette annonce</h2>
              <p>Les créneaux apparaîtront dès qu’ils pourront être identifiés par BigBadBot.</p>
            </div>
            <div v-else class="training-roster-layout">
              <TrainingSessionPicker
                :sessions="data.announcement.sessions"
                :active-session-key="activeSessionKey"
                :loading="loading"
                @select="selectSession"
              />

              <section
                id="roster-participants"
                class="training-roster-participants"
                aria-labelledby="roster-participants-title"
              >
                <template v-if="loading">
                  <header class="training-roster-participants__heading">
                    <p class="eyebrow">Sélection en cours</p>
                    <h2 id="roster-participants-title">
                      {{ loadingSession?.label ?? 'Vérification des participants' }}
                    </h2>
                  </header>
                  <AppLoadingState
                    class="training-roster-participants__loading"
                    :label="
                      loadingSession
                        ? `Chargement des inscrits · ${loadingSession.label}…`
                        : 'Chargement des participants…'
                    "
                    description="Les noms s’afficheront après confirmation de ton accès et des inscriptions."
                    variant="list"
                    :count="4"
                  />
                </template>
                <template v-else-if="selectedSession">
                  <header class="training-roster-participants__heading">
                    <p class="eyebrow">{{ selectionLabel }}</p>
                    <h2 id="roster-participants-title">{{ selectedSession.label }}</h2>
                    <p>
                      {{ formatDay(selectedSession.startsAt) }} ·
                      {{ formatTime(selectedSession.startsAt) }} –
                      {{ formatTime(selectedSession.endsAt) }}
                    </p>
                    <p v-if="selectedSession.details" class="training-roster-participants__details">
                      {{ selectedSession.details }}
                    </p>
                    <dl class="training-roster-counts">
                      <div>
                        <dt>Inscrits</dt>
                        <dd>
                          {{ data.participants.length
                          }}<span> / {{ selectedSession.capacity }}</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Flyers confirmés par leur rôle</dt>
                        <dd>{{ flyerCount }}</dd>
                      </div>
                    </dl>
                  </header>

                  <p class="training-roster-note">
                    Ces inscriptions ne confirment pas la présence. Les équipes et le statut Flyer
                    correspondent aux rôles Discord actuels.
                  </p>

                  <div v-if="data.participants.length" class="roster-explorer">
                    <details class="roster-team-filter">
                      <summary>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          aria-hidden="true"
                        >
                          <path d="M4 7h16M7 12h10M10 17h4" stroke-linecap="round" />
                        </svg>
                        <span
                          ><strong>Filtrer par équipe</strong
                          ><small>{{ teamSelectionLabel }}</small></span
                        >
                        <span v-if="selectedTeams.length" class="roster-filter-count">{{
                          selectedTeams.length
                        }}</span>
                        <svg
                          class="roster-filter-chevron"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          aria-hidden="true"
                        >
                          <path d="m7 10 5 5 5-5" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </summary>
                      <div class="roster-team-filter__content">
                        <p>
                          Choisis une ou plusieurs équipes. Un athlète de plusieurs équipes apparaît
                          une seule fois.
                        </p>
                        <div class="roster-team-chips" role="group" aria-label="Équipes à afficher">
                          <button
                            type="button"
                            :aria-pressed="!selectedTeams.length"
                            aria-controls="roster-member-results"
                            @click="selectedTeams = []"
                          >
                            Toutes <span>{{ data.participants.length }}</span>
                          </button>
                          <button
                            v-for="team in teamOptions"
                            :key="team.key"
                            type="button"
                            :aria-pressed="selectedTeams.includes(team.key)"
                            aria-controls="roster-member-results"
                            @click="toggleTeam(team.key)"
                          >
                            <span
                              v-if="selectedTeams.includes(team.key)"
                              class="roster-team-check"
                              aria-hidden="true"
                              >✓</span
                            >
                            {{ team.label }} <span>{{ team.count }}</span>
                          </button>
                        </div>
                      </div>
                    </details>
                    <div class="roster-explorer__tools">
                      <label class="roster-search">
                        <span>Rechercher un athlète</span>
                        <span class="roster-search__input">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            aria-hidden="true"
                          >
                            <circle cx="10.5" cy="10.5" r="6.5" />
                            <path d="m16 16 4 4" stroke-linecap="round" />
                          </svg>
                          <input
                            v-model="participantSearch"
                            type="search"
                            placeholder="Nom ou pseudo…"
                            autocomplete="off"
                            spellcheck="false"
                            aria-controls="roster-member-results"
                          />
                        </span>
                      </label>
                      <label class="roster-sort">
                        <span>Trier les athlètes</span>
                        <select v-model="participantSort" aria-controls="roster-member-results">
                          <option value="name">Nom · A → Z</option>
                          <option value="registration">Ordre de la liste</option>
                        </select>
                      </label>
                    </div>
                    <div class="roster-results-summary">
                      <p role="status" aria-live="polite" aria-atomic="true">
                        <strong>{{ visibleParticipants.length }}</strong> sur
                        {{ data.participants.length }} inscrit{{
                          data.participants.length > 1 ? 's' : ''
                        }}
                        <span
                          >· {{ visibleFlyerCount }} flyer{{
                            visibleFlyerCount > 1 ? 's' : ''
                          }}</span
                        >
                      </p>
                      <button
                        v-if="hasParticipantFilters"
                        type="button"
                        @click="resetParticipantFilters"
                      >
                        Réinitialiser les filtres
                      </button>
                    </div>
                  </div>
                  <div id="roster-member-results">
                    <ul
                      v-if="visibleParticipants.length"
                      class="training-roster-member-list"
                      aria-label="Participants inscrits"
                    >
                      <li
                        v-for="participant in visibleParticipants"
                        :key="participant.key"
                        class="training-roster-member"
                      >
                        <span class="training-roster-member__initials" aria-hidden="true">{{
                          participant.profileAvailable
                            ? (participant.displayName || participant.username)
                                .slice(0, 1)
                                .toLocaleUpperCase('fr-FR')
                            : '?'
                        }}</span>
                        <div class="training-roster-member__content">
                          <h3>
                            {{
                              participant.profileAvailable
                                ? participant.displayName || participant.username
                                : 'Profil Discord indisponible'
                            }}
                          </h3>
                          <p
                            v-if="participant.profileAvailable && participant.username"
                            class="training-roster-member__username"
                          >
                            @{{ participant.username }}
                          </p>
                          <div class="training-roster-member__badges">
                            <template v-if="participant.profileAvailable"
                              ><span
                                v-for="teamKey in participant.teamKeys"
                                :key="teamKey"
                                class="training-roster-badge"
                                >{{ TEAM_STATISTICS_TEAMS[teamKey] }}</span
                              ><span
                                v-if="!participant.teamKeys.length"
                                class="training-roster-badge training-roster-badge--muted"
                                >Équipe non renseignée</span
                              ></template
                            >
                            <span v-else class="training-roster-badge training-roster-badge--muted"
                              >Équipe non vérifiable</span
                            >
                            <span
                              :class="[
                                'training-roster-badge',
                                participant.profileAvailable && participant.isFlyer === true
                                  ? 'training-roster-badge--flyer'
                                  : 'training-roster-badge--muted',
                              ]"
                              >{{
                                !participant.profileAvailable || participant.isFlyer === null
                                  ? 'Statut Flyer non vérifiable'
                                  : participant.isFlyer
                                    ? 'Flyer'
                                    : 'Non-flyer'
                              }}</span
                            >
                          </div>
                        </div>
                      </li>
                    </ul>
                    <div
                      v-else-if="data.participants.length"
                      class="training-roster-empty training-roster-empty--filtered"
                    >
                      <span class="roster-empty-icon" aria-hidden="true">⌕</span>
                      <h3>Aucun athlète avec ces filtres</h3>
                      <p>Essaie une autre équipe ou un autre nom pour ce créneau.</p>
                      <button
                        class="button button--ghost"
                        type="button"
                        @click="resetParticipantFilters"
                      >
                        Afficher tous les inscrits
                      </button>
                    </div>
                    <div v-else class="training-roster-empty">
                      <h3>Personne d’inscrit pour le moment</h3>
                      <p>La liste se complétera au fil des inscriptions.</p>
                      <NuxtLink class="button button--primary" to="/inscriptions"
                        >Voir mes possibilités d’inscription
                        <span class="button__arrow" aria-hidden="true">→</span></NuxtLink
                      >
                    </div>
                  </div>
                  <p v-if="unavailableProfileCount" class="training-roster-note">
                    {{ unavailableProfileCount }} profil{{
                      unavailableProfileCount === 1 ? '' : 's'
                    }}
                    Discord ne peu{{ unavailableProfileCount === 1 ? 't' : 'vent' }} pas être
                    confirmé{{ unavailableProfileCount === 1 ? '' : 's' }}. Ces inscriptions restent
                    comptabilisées. Le filtre « Profil indisponible », sans recherche de nom, permet
                    de les retrouver.
                  </p>
                </template>
                <div v-else class="training-roster-empty">
                  <h2 id="roster-participants-title">Sélectionne un créneau</h2>
                  <p>Choisis un créneau dans la liste pour consulter ses participants.</p>
                </div>
              </section>
            </div>
          </template>
          <p v-if="!loading" class="training-roster-updated">
            Liste vérifiée le {{ formatDateTime(data.generatedAt) }} · Actualise pour consulter les
            dernières modifications.
          </p>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.training-roster-page {
  min-height: 72dvh;
}
.training-roster-hero {
  padding-block: clamp(3.5rem, 8vw, 7rem) clamp(2.5rem, 5vw, 4rem);
  border-bottom: 0.08rem solid var(--line);
  background:
    linear-gradient(120deg, rgb(42 56 144 / 38%), transparent 58%),
    radial-gradient(circle at 88% 20%, rgb(255 132 39 / 14%), transparent 24rem);
}
.training-roster-hero__inner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.5rem;
}
.training-roster-hero__inner > div {
  flex: 1 1 35rem;
  min-width: 0;
}
.training-roster-hero h1 {
  max-width: 13ch;
  font-size: clamp(2.8rem, 7vw, 6.5rem);
}
.training-roster-hero__intro {
  max-width: 42rem;
  margin-top: 1.4rem;
  color: var(--muted);
  font-size: clamp(1rem, 1.8vw, 1.2rem);
}
.training-roster-hero__access {
  padding: 0.55rem 0.8rem;
  border: 0.08rem solid var(--line);
  border-radius: var(--radius);
  color: var(--muted);
  font-size: 0.8rem;
}
.training-roster-content {
  display: grid;
  min-width: 0;
  gap: 1.5rem;
}
.training-roster-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
.training-roster-refresh {
  min-height: 2.75rem;
  padding: 0.65rem 1rem;
  font-size: 0.8rem;
}
.training-roster-refresh:disabled {
  cursor: wait;
  opacity: 0.6;
}
.training-roster-state {
  padding: clamp(1.4rem, 4vw, 2.5rem);
  border: 0.08rem solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, rgb(42 56 144 / 18%), transparent 60%), var(--ink-soft);
}
.training-roster-state h2 {
  margin-top: 0.6rem;
  font-family: var(--display);
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1.05;
  text-transform: uppercase;
}
.training-roster-state > p:not(.eyebrow) {
  max-width: 45rem;
  margin-top: 1rem;
  color: var(--muted);
}
.training-roster-state .button {
  margin-top: 1.5rem;
}
.training-roster-announcement {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
.training-roster-announcement h2 {
  margin-top: 0.45rem;
  font-size: clamp(1.25rem, 2vw, 1.6rem);
  font-weight: 800;
  overflow-wrap: anywhere;
}
.training-roster-announcement > p {
  color: var(--muted);
  font-size: 0.8rem;
}
.training-roster-layout {
  display: grid;
  grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
  align-items: start;
  gap: 1.3rem;
}
.training-roster-participants {
  min-width: 0;
  padding: clamp(1rem, 2.5vw, 1.5rem);
  border: 0.08rem solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--ink-soft);
}
.training-roster-participants__loading {
  margin-top: 1.2rem;
}
.training-roster-participants__heading h2 {
  margin-top: 0.6rem;
  font-family: var(--display);
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  line-height: 1.05;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}
.training-roster-participants__heading > p:not(.eyebrow) {
  margin-top: 0.6rem;
  color: var(--muted);
  font-size: 0.9rem;
}
.training-roster-participants__details {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.training-roster-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2rem;
  margin-top: 1.4rem;
}
.training-roster-counts dt {
  color: var(--muted);
  font-size: 0.75rem;
}
.training-roster-counts dd {
  margin-top: 0.2rem;
  font-size: 1.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.training-roster-counts dd span {
  color: var(--muted);
  font-size: 1rem;
  font-weight: 400;
}
.training-roster-note {
  margin-top: 1rem;
  padding: 0.75rem 0.9rem;
  border-left: 0.18rem solid var(--orange);
  border-radius: var(--radius-sm);
  color: var(--muted);
  background: rgb(255 132 39 / 6%);
  font-size: 0.78rem;
}
.training-roster-member-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 0.75rem;
  margin-top: 1.2rem;
  list-style: none;
}
.training-roster-member {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  min-width: 0;
  padding: 1rem;
  border: 0.08rem solid var(--line);
  border-radius: var(--radius);
  background: rgb(255 255 255 / 3%);
}
.training-roster-member__initials {
  display: grid;
  flex: 0 0 2rem;
  height: 2rem;
  place-items: center;
  border-radius: var(--radius);
  color: var(--paper);
  background: var(--indigo);
  font-size: 0.9rem;
  font-weight: 800;
}
.training-roster-member__content {
  flex: 1;
  min-width: 0;
}
.training-roster-member h3 {
  font-size: 0.9rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.training-roster-member__username {
  margin-top: 0.15rem;
  color: var(--muted);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.training-roster-member__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.65rem;
}
.training-roster-badge {
  max-width: 100%;
  padding: 0.25rem 0.45rem;
  border: 0.06rem solid rgb(255 255 255 / 12%);
  border-radius: var(--radius-sm);
  color: var(--paper);
  background: rgb(61 78 175 / 22%);
  font-size: 0.68rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.training-roster-badge--flyer {
  border-color: rgb(255 132 39 / 45%);
  color: var(--orange);
  background: rgb(255 132 39 / 8%);
}
.training-roster-badge--muted {
  color: var(--muted);
  background: rgb(255 255 255 / 3%);
  font-weight: 400;
}
.training-roster-empty {
  padding-block: 1.8rem 0.8rem;
}
.training-roster-empty h3 {
  font-size: 1.05rem;
  font-weight: 800;
}
.training-roster-empty p {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.85rem;
}
.training-roster-empty .button {
  margin-top: 1.2rem;
  font-size: 0.8rem;
}
.training-roster-updated {
  color: var(--muted);
  font-size: 0.75rem;
}
.roster-explorer {
  display: grid;
  gap: 1rem;
  margin-top: 1.4rem;
  padding-top: 1.4rem;
  border-top: 0.08rem solid var(--line);
}
.roster-team-filter {
  border: 0.08rem solid var(--line);
  border-radius: var(--radius-lg);
  background: rgb(255 255 255 / 3%);
}
.roster-team-filter summary {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 3.75rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-lg);
  list-style: none;
  cursor: pointer;
}
.roster-team-filter summary::-webkit-details-marker {
  display: none;
}
.roster-team-filter summary > span:first-of-type {
  flex: 1;
  min-width: 0;
}
.roster-team-filter summary strong,
.roster-team-filter summary small {
  display: block;
  overflow-wrap: anywhere;
}
.roster-team-filter summary strong {
  font-size: 0.9rem;
}
.roster-team-filter summary small {
  margin-top: 0.2rem;
  color: var(--muted);
  font-size: 0.75rem;
}
.roster-team-filter summary > svg,
.roster-search svg {
  flex: 0 0 1.25rem;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--orange);
}
.roster-filter-count {
  display: grid;
  flex: 0 0 1.5rem;
  height: 1.5rem;
  place-items: center;
  border-radius: 50%;
  background: var(--orange);
  color: var(--ink);
  font-size: 0.75rem;
  font-weight: 800;
}
.roster-team-filter[open] .roster-filter-chevron {
  rotate: 180deg;
}
.roster-team-filter__content {
  padding: 0 1rem 1rem;
}
.roster-team-filter__content > p {
  margin-bottom: 0.85rem;
  color: var(--muted);
  font-size: 0.75rem;
}
.roster-team-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.roster-team-chips button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  max-width: 100%;
  padding: 0.5rem 0.8rem;
  border: 0.08rem solid var(--line);
  border-radius: 2rem;
  background: var(--ink-soft);
  color: var(--paper);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.roster-team-chips button:hover {
  border-color: var(--orange);
}
.roster-team-chips button[aria-pressed='true'] {
  border-color: var(--orange);
  background: var(--orange);
  color: var(--ink);
}
.roster-team-chips button > span:not(.roster-team-check) {
  min-width: 1.25rem;
  padding-inline: 0.2rem;
  border-radius: 1rem;
  background: rgb(0 0 0 / 12%);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}
.roster-explorer__tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(8.5rem, 0.55fr);
  gap: 0.75rem;
}
.roster-search,
.roster-sort {
  display: grid;
  min-width: 0;
  gap: 0.4rem;
  color: var(--muted);
  font-size: 0.75rem;
}
.roster-search__input {
  position: relative;
  display: flex;
  align-items: center;
}
.roster-search svg {
  position: absolute;
  left: 0.8rem;
  pointer-events: none;
}
.roster-search input,
.roster-sort select {
  width: 100%;
  min-width: 0;
  min-height: 2.9rem;
  padding: 0.6rem 0.7rem;
  border: 0.08rem solid var(--line);
  border-radius: var(--radius);
  background: var(--ink);
  color: var(--paper);
  font: inherit;
  font-size: 1rem;
  color-scheme: dark;
}
.roster-search input {
  padding-left: 2.6rem;
}
.roster-search input::placeholder {
  color: var(--muted);
}
.roster-results-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.3rem 0.75rem;
  min-height: 2.75rem;
  font-size: 0.8rem;
}
.roster-results-summary p > span {
  color: var(--muted);
}
.roster-results-summary strong {
  font-variant-numeric: tabular-nums;
}
.roster-results-summary button {
  min-height: 2.75rem;
  padding: 0.4rem;
  background: transparent;
  color: var(--orange);
  font: inherit;
  font-size: 0.75rem;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
.training-roster-empty--filtered {
  padding: 1.5rem 0.75rem;
  text-align: center;
}
.roster-empty-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  margin: 0 auto 1rem;
  place-items: center;
  border: 0.08rem solid var(--line);
  border-radius: 50%;
  color: var(--orange);
  font-size: 1.8rem;
}
@media (max-width: 900px) {
  .training-roster-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 700px) {
  .training-roster-hero {
    padding-block: 2rem 1.8rem;
  }
  .training-roster-hero h1 {
    max-width: 17ch;
    font-size: clamp(2.4rem, 9vw, 3.8rem);
  }
  .training-roster-hero__intro {
    margin-top: 0.75rem;
    font-size: 0.9rem;
  }
  .training-roster-hero__access {
    padding-block: 0.35rem;
  }
  .training-roster-participants {
    scroll-margin-top: 13rem;
  }
  .training-roster-toolbar {
    justify-content: flex-end;
  }
  .training-roster-announcement > p {
    font-size: 0.72rem;
  }
}
@media (max-width: 500px) {
  .training-roster-page .button {
    max-width: 100%;
    justify-content: center;
    white-space: normal;
    text-align: center;
  }
  .training-roster-member {
    padding: 0.85rem;
  }
  .training-roster-participants__heading .eyebrow {
    font-size: 0.66rem;
  }
}
@media (max-width: 380px) {
  .roster-explorer__tools {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .training-roster-page .button {
    transition: none;
  }
}
</style>
