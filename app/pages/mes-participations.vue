<script setup lang="ts">
import type { MemberParticipationsResponse } from '../../shared/types/participations'

const { loggedIn, fetch: refreshSession } = useUserSession()
const loggingOut = ref(false)
const logoutError = ref('')
const categoryLabels: Record<string, string> = {
  open_gym: 'Open Gym',
  workshop: 'Atelier',
  other: 'Autre activité',
}

const {
  data: dashboard,
  clear: clearDashboard,
  error,
  refresh,
  status,
} = await useFetch<MemberParticipationsResponse>('/api/member/participations', {
  key: `member-participations:${useId()}`,
  server: false,
  lazy: true,
  retry: 0,
  timeout: 60_000,
  getCachedData: () => undefined,
})
const initialLoading = computed(
  () =>
    loggedIn.value && !dashboard.value && (status.value === 'idle' || status.value === 'pending'),
)
watch(loggedIn, (authenticated) => {
  if (!authenticated) clearDashboard()
})
onBeforeUnmount(() => clearDashboard())

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
})
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})

const errorStatus = computed(() => {
  const candidate = error.value as {
    status?: unknown
    statusCode?: unknown
    response?: { status?: unknown }
  } | null
  const value = candidate?.statusCode ?? candidate?.status ?? candidate?.response?.status

  return typeof value === 'number' ? value : null
})
const isUnauthorized = computed(() => errorStatus.value === 401)
const isForbidden = computed(() => errorStatus.value === 403)
const authenticationMessage = computed(() => {
  if (isForbidden.value) {
    return {
      title: 'Accès Wolves requis',
      text: "Ton compte Discord doit pouvoir consulter le salon Wolves ou être associé à un historique d'inscription BigBadBot.",
    }
  }

  return {
    title: 'Connecte ton compte Discord',
    text: "L'accès à cette page est personnel. Le site utilise ton identifiant Discord pour ne charger que tes propres inscriptions.",
  }
})
const summary = computed(() => dashboard.value?.stats.summary)
const timeSeries = computed(() => dashboard.value?.stats.timeSeries)
const maxTimeRegistrations = computed(() =>
  Math.max(0, ...(timeSeries.value?.points.map(({ registrations }) => registrations) || [])),
)
const maxBreakdownRegistrations = computed(() =>
  Math.max(
    0,
    ...(dashboard.value?.stats.breakdown.map(({ registrations }) => registrations) || []),
  ),
)

function parseDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value
  const parsed = new Date(normalized)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(value: string | null) {
  if (!value) return 'Date à confirmer'
  const parsed = parseDate(value)

  return parsed ? dateFormatter.format(parsed) : 'Date à confirmer'
}

function formatDateTime(value: string | null) {
  if (!value) return 'Synchronisation à confirmer'
  const parsed = parseDate(value)

  return parsed
    ? `Données synchronisées le ${dateTimeFormatter.format(parsed)}`
    : 'Synchronisation à confirmer'
}

function barWidth(value: number, maximum: number) {
  if (value <= 0 || maximum <= 0) return '0%'

  return `${Math.max(4, Math.round((value / maximum) * 100))}%`
}

function registrationLabel(value: number) {
  return `${value} inscription${value === 1 ? '' : 's'}`
}

function categoryLabel(value: string) {
  return categoryLabels[value] || value
}

async function logout() {
  if (loggingOut.value) return

  loggingOut.value = true
  logoutError.value = ''

  try {
    await $fetch('/auth/logout', { method: 'POST' })
    clearDashboard()
    clearNuxtData('member-participations')
    await refreshSession()
    await navigateTo('/')
  } catch {
    logoutError.value = 'La déconnexion a échoué. Réessaie dans quelques instants.'
  } finally {
    loggingOut.value = false
  }
}

usePageSeo({
  title: 'Mes participations',
  description: 'Espace personnel des inscriptions aux open gyms et ateliers des Wolves Toulouse.',
  path: '/mes-participations',
  noindex: true,
})

definePageMeta({
  middleware: 'member-participations',
})
</script>

<template>
  <div class="participations-page">
    <section class="participations-hero" aria-labelledby="participations-title">
      <div class="container participations-hero__inner">
        <div>
          <p class="eyebrow">Espace personnel</p>
          <h1 id="participations-title" class="display-title">Mes participations</h1>
          <p class="participations-hero__intro">
            Retrouve les inscriptions aux open gyms et ateliers associées à ton compte Discord.
          </p>
        </div>

        <div v-if="loggedIn && dashboard" class="participations-profile">
          <div>
            <strong>{{ dashboard.user.displayName || dashboard.user.username }}</strong>
            <span>@{{ dashboard.user.username }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--compact">
      <div class="container participations-content">
        <MemberSpaceNavigation v-if="loggedIn" />
        <div v-if="loggedIn && dashboard && !error" class="participations-notice" role="note">
          <strong>Inscriptions, pas présences confirmées.</strong>
          <span>
            Ce tableau reprend les inscriptions enregistrées par BigBadBot. Il ne confirme pas la
            présence effective aux séances.
          </span>
        </div>

        <div v-if="loggedIn && dashboard && !error" class="participations-toolbar">
          <div>
            <strong>{{ dashboard.period.label }}</strong>
            <span>
              Du {{ formatDate(dashboard.period.startDate) }} au
              {{ formatDate(dashboard.period.endDate) }}
            </span>
          </div>
          <span>{{ formatDateTime(dashboard.generatedAt) }}</span>
        </div>

        <div v-if="!loggedIn || isUnauthorized || isForbidden" class="participations-state">
          <p class="eyebrow">{{ isForbidden ? 'Accès Wolves requis' : 'Connexion requise' }}</p>
          <h2>{{ authenticationMessage.title }}</h2>
          <p>{{ authenticationMessage.text }}</p>
          <NuxtLink class="button button--primary" to="/admin/login?redirect=/mes-participations">
            {{ isForbidden ? 'Revenir à la connexion Discord' : 'Se connecter avec Discord' }}
            <span class="button__arrow" aria-hidden="true">→</span>
          </NuxtLink>
        </div>

        <div v-else-if="error" class="participations-state" role="alert">
          <p class="eyebrow">Données indisponibles</p>
          <h2>Impossible de charger tes inscriptions</h2>
          <p>
            La synchronisation avec BigBadBot est momentanément indisponible. Aucune donnée brute
            n'est affichée.
          </p>
          <button class="button button--primary" type="button" @click="refresh()">Réessayer</button>
        </div>

        <AppLoadingState
          v-else-if="initialLoading"
          label="Chargement de tes participations…"
          description="BigBadBot vérifie ton accès et retrouve ton historique d’inscription."
          variant="detail"
          :count="5"
        />

        <template v-else-if="loggedIn && dashboard && summary">
          <AppLoadingStatus
            v-if="status === 'pending'"
            label="Actualisation de tes participations…"
          />
          <dl class="participations-kpis" aria-label="Résumé de mes inscriptions">
            <div>
              <dt>Inscriptions enregistrées</dt>
              <dd>{{ summary.registrations }}</dd>
              <small>Sur la période affichée</small>
            </div>
            <div>
              <dt>Semaines avec inscription</dt>
              <dd>{{ summary.totalActiveWeeks }}</dd>
              <small>Au moins une inscription dans la semaine</small>
            </div>
            <div>
              <dt>Régularité des inscriptions</dt>
              <dd>
                {{ summary.regularityPercent === null ? '—' : `${summary.regularityPercent} %` }}
              </dd>
              <small v-if="summary.clubActiveWeeks > 0">
                {{ summary.totalActiveWeeks }} sur {{ summary.clubActiveWeeks }} semaines d'activité
                du club
              </small>
              <small v-else>Pas assez de semaines pour la calculer</small>
            </div>
            <div>
              <dt>Annulations enregistrées</dt>
              <dd>{{ summary.cancellations }}</dd>
              <small>
                Retraits conservés dans l’historique BigBadBot ; les données anciennes peuvent être
                partielles
              </small>
            </div>
            <div>
              <dt>Annulations tardives</dt>
              <dd>{{ summary.lateCancellations }}</dd>
              <small>Annulations enregistrées moins de 24&nbsp;h avant le créneau</small>
            </div>
          </dl>

          <div v-if="summary.registrations === 0" class="participations-state">
            <p class="eyebrow">Aucune inscription</p>
            <h2>Rien d'enregistré sur cette période</h2>
            <p>
              Les prochaines propositions d'open gym et d'atelier sont publiées sur le Discord du
              club.
            </p>
          </div>

          <div v-else class="participations-panels">
            <section class="participations-panel" aria-labelledby="participations-timeline-title">
              <header>
                <div>
                  <p class="eyebrow">
                    {{ timeSeries?.granularity === 'monthly' ? 'Par mois' : 'Par semaine' }}
                  </p>
                  <h2 id="participations-timeline-title">Rythme d'inscription</h2>
                </div>
              </header>

              <ol v-if="timeSeries?.points.length" class="participations-bars">
                <li v-for="point in timeSeries.points" :key="point.periodStart">
                  <span>{{ point.label }}</span>
                  <div class="participations-bars__track" aria-hidden="true">
                    <span
                      :style="{
                        width: barWidth(point.registrations, maxTimeRegistrations),
                      }"
                    />
                  </div>
                  <strong>{{ registrationLabel(point.registrations) }}</strong>
                </li>
              </ol>
              <p v-else class="participations-panel__empty">
                Aucun historique temporel disponible.
              </p>
            </section>

            <section class="participations-panel" aria-labelledby="participations-breakdown-title">
              <header>
                <div>
                  <p class="eyebrow">Open gyms & ateliers</p>
                  <h2 id="participations-breakdown-title">Par type d'activité</h2>
                </div>
              </header>

              <ol v-if="dashboard.stats.breakdown.length" class="participations-bars">
                <li v-for="item in dashboard.stats.breakdown" :key="item.key">
                  <span>{{ item.label }}</span>
                  <div class="participations-bars__track" aria-hidden="true">
                    <span
                      :style="{
                        width: barWidth(item.registrations, maxBreakdownRegistrations),
                      }"
                    />
                  </div>
                  <strong>{{ registrationLabel(item.registrations) }}</strong>
                </li>
              </ol>
              <p v-else class="participations-panel__empty">Aucune catégorie disponible.</p>
            </section>
          </div>

          <section
            v-if="summary.registrations > 0"
            class="participations-panel participations-panel--recent"
            aria-labelledby="participations-recent-title"
          >
            <header>
              <div>
                <p class="eyebrow">Historique personnel</p>
                <h2 id="participations-recent-title">Inscriptions récentes</h2>
              </div>
            </header>

            <ul v-if="dashboard.stats.recent.length" class="participations-recent">
              <li
                v-for="(item, index) in dashboard.stats.recent"
                :key="`${item.startsAt || 'unknown'}-${item.label}-${index}`"
              >
                <span>Semaine du {{ formatDate(item.startsAt) }}</span>
                <strong>{{ item.label }}</strong>
                <small>{{ categoryLabel(item.category) }}</small>
              </li>
            </ul>
            <p v-else class="participations-panel__empty">
              Le détail des inscriptions n'est pas disponible pour cette période.
            </p>
          </section>

          <div class="participations-account">
            <p v-if="logoutError" role="alert">{{ logoutError }}</p>
            <button
              class="button button--ghost"
              type="button"
              :disabled="loggingOut"
              @click="logout"
            >
              {{ loggingOut ? 'Déconnexion…' : 'Se déconnecter' }}
            </button>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.participations-page {
  min-height: 72dvh;
}

.participations-hero {
  padding-block: clamp(3.5rem, 8vw, 7rem) clamp(2.5rem, 5vw, 4rem);
  border-bottom: 0.08rem solid var(--line);
  background:
    linear-gradient(120deg, rgb(42 56 144 / 38%), transparent 58%),
    radial-gradient(circle at 88% 20%, rgb(255 132 39 / 14%), transparent 24rem);
}

.participations-hero__inner {
  display: grid;
  align-items: end;
  gap: 2rem;
}

.participations-hero__intro {
  max-width: 43rem;
  margin-top: 1.4rem;
  color: var(--muted);
  font-size: clamp(1rem, 1.8vw, 1.25rem);
}

.participations-profile {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.8rem 1rem;
  border: 0.08rem solid var(--line);
  border-radius: var(--radius);
  background: rgb(255 255 255 / 5%);
}

.participations-profile div {
  display: grid;
  min-width: 0;
}

.participations-profile strong,
.participations-profile span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.participations-profile span {
  color: var(--muted);
  font-size: 0.85rem;
}

.participations-content {
  display: grid;
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

.participations-notice {
  display: grid;
  gap: 0.3rem;
  padding: 1rem 1.15rem;
  border-left: 0.3rem solid var(--orange);
  border-radius: var(--radius-sm);
  background: rgb(255 132 39 / 10%);
}

.participations-notice span,
.participations-toolbar span {
  color: var(--muted);
  font-size: 0.88rem;
}

.participations-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.participations-toolbar > div {
  display: grid;
  gap: 0.2rem;
}

.participations-toolbar > span {
  text-align: right;
}

.participations-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: 1rem;
}

.participations-kpis > div,
.participations-panel,
.participations-state {
  border: 0.08rem solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, rgb(42 56 144 / 18%), transparent 60%), var(--ink-soft);
  box-shadow: 0 1rem 2.5rem rgb(11 18 56 / 18%);
}

.participations-kpis > div {
  display: grid;
  min-height: 11rem;
  align-content: start;
  padding: clamp(1.1rem, 3vw, 1.6rem);
}

.participations-kpis dt {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.3;
  text-transform: uppercase;
}

.participations-kpis dd {
  margin-top: 0.45rem;
  color: var(--orange);
  font-family: var(--display);
  font-size: clamp(2.8rem, 6vw, 4.5rem);
  letter-spacing: 0.02em;
  line-height: 0.95;
}

.participations-kpis small {
  margin-top: 0.7rem;
  color: var(--muted);
  line-height: 1.45;
}

.participations-panels {
  display: grid;
  gap: 1rem;
}

.participations-panel {
  min-width: 0;
  padding: clamp(1.25rem, 3vw, 2rem);
}

.participations-panel header {
  margin-bottom: 1.5rem;
}

.participations-panel h2,
.participations-state h2 {
  margin-top: 0.6rem;
  font-family: var(--display);
  font-size: clamp(2rem, 5vw, 3.2rem);
  letter-spacing: 0.01em;
  line-height: 0.95;
  text-transform: uppercase;
}

.participations-bars,
.participations-recent {
  display: grid;
  gap: 1rem;
  list-style: none;
}

.participations-bars li {
  display: grid;
  grid-template-columns: minmax(6rem, 0.7fr) minmax(8rem, 1.6fr) minmax(6.5rem, 0.6fr);
  align-items: center;
  gap: 0.8rem;
}

.participations-bars li > span:first-child {
  overflow: hidden;
  font-size: 0.88rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.participations-bars li > strong {
  font-size: 0.8rem;
}

.participations-bars__track {
  height: 0.72rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(255 255 255 / 9%);
}

.participations-bars__track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--orange), var(--orange-soft));
}

.participations-panel__empty,
.participations-state > p:not(.eyebrow) {
  max-width: 42rem;
  margin-top: 1rem;
  color: var(--muted);
}

.participations-state {
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

.participations-state .button {
  margin-top: 1.5rem;
}

.participations-recent {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.participations-recent li {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 0.08rem solid var(--line);
  border-radius: var(--radius);
  background: rgb(255 255 255 / 4%);
}

.participations-recent span,
.participations-recent small {
  color: var(--muted);
  font-size: 0.78rem;
}

.participations-recent strong {
  line-height: 1.35;
}

.participations-account {
  display: grid;
  justify-items: start;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 0.08rem solid var(--line);
}

.participations-account p {
  color: var(--orange-soft);
}

.participations-account button:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (min-width: 64rem) {
  .participations-hero__inner {
    grid-template-columns: minmax(0, 1fr) minmax(15rem, 20rem);
  }

  .participations-panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 48rem) {
  .participations-toolbar {
    display: grid;
  }

  .participations-toolbar > span {
    text-align: left;
  }

  .participations-kpis {
    grid-template-columns: 1fr;
  }

  .participations-kpis > div {
    min-height: auto;
  }

  .participations-bars li {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .participations-bars__track {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .participations-recent {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .participations-page .button {
    transition: none;
  }
}
</style>
