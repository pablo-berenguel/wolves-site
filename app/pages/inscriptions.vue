<script setup lang="ts">
import type {
  MemberRegistrationCommandResponse,
  MemberRegistrationResponse,
  MemberRegistrationSession,
  RegistrationAction,
  RegistrationCommandCode,
} from '../../shared/types/registrations'

const { loggedIn } = useUserSession()
const pendingSessions = ref<Record<string, boolean>>({})
const actionMessage = ref('')
const actionError = ref('')
let pageActive = true

const {
  data: registration,
  error,
  refresh,
  status,
  clear: clearRegistration,
} = await useFetch<MemberRegistrationResponse>('/api/member/registration', {
  key: `member-registration:${useId()}`,
  server: false,
  lazy: true,
  retry: 0,
  timeout: 60_000,
  getCachedData: () => undefined,
})
const initialLoading = computed(
  () =>
    loggedIn.value &&
    !registration.value &&
    (status.value === 'idle' || status.value === 'pending'),
)
watch(loggedIn, (authenticated) => {
  if (!authenticated) clearRegistration()
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

function parseDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateTime(value: string | null) {
  const parsed = parseDate(value)

  return parsed ? dateTimeFormatter.format(parsed) : 'Horaire à confirmer'
}

function remainingLabel(session: MemberRegistrationSession) {
  if (session.capacity === null || session.remaining === null) {
    return `${session.registeredCount} personne${session.registeredCount === 1 ? '' : 's'} inscrite${session.registeredCount === 1 ? '' : 's'}`
  }

  if (session.isFull) return 'Complet'
  if (session.remaining === 1) return '1 place restante'

  return `${session.remaining} places restantes`
}

function eligibilityLabel(session: MemberRegistrationSession) {
  if (session.eligibilityReason === 'missing_role') {
    return "Ton compte Discord n'a pas le rôle requis pour ce créneau."
  }

  if (session.eligibilityReason === 'team_restricted') {
    return 'Ce créneau est réservé à une autre équipe.'
  }

  return ''
}

function discordLink(session: MemberRegistrationSession) {
  return session.discordUrl || registration.value?.announcement?.discordUrl || null
}

function commandErrorMessage(code: RegistrationCommandCode | null) {
  const messages: Record<RegistrationCommandCode, string> = {
    already_registered: 'Tu es déjà inscrit·e à ce créneau.',
    not_registered: "Cette inscription n'est plus active.",
    full: 'Le créneau vient de se remplir. Tu peux activer une alerte.',
    missing_role: 'Ton rôle Discord ne permet pas cette inscription.',
    not_guild_member: "Ton compte n'est plus membre du serveur Discord du club.",
    channel_forbidden: "Ton compte n'a plus accès aux annonces d'entraînement.",
    stale_session: "Cette annonce n'est plus la plus récente. La page va être actualisée.",
    discord_unavailable: 'Discord est momentanément indisponible. Réessaie dans un instant.',
    bridge_unavailable: 'BigBadBot est momentanément indisponible. Réessaie dans un instant.',
    places_available: 'Une place est déjà disponible : tu peux t’inscrire directement.',
    alert_not_enabled: 'Cette alerte n’était plus active.',
    idempotency_conflict: "La commande n'a pas pu être rejouée en sécurité.",
    native_reaction_required: "Cette inscription doit être terminée dans l'application Discord.",
    rate_limited: 'Tu as effectué trop d’actions à la suite. Patiente une minute puis réessaie.',
  }

  return code ? messages[code] : "La commande n'a pas pu être appliquée."
}

function successMessage(action: RegistrationAction) {
  const messages: Record<RegistrationAction, string> = {
    register: 'Ton inscription est confirmée.',
    cancel: 'Ton inscription est annulée.',
    subscribe_alert: 'Alerte activée. BigBadBot te préviendra par message privé Discord.',
    unsubscribe_alert: 'Alerte désactivée.',
  }

  return messages[action]
}

async function waitForCommand(command: MemberRegistrationCommandResponse) {
  let current = command
  const startedAt = Date.now()

  while (current.status === 'pending' && Date.now() - startedAt < 15_000 && pageActive) {
    const delay = Date.now() - startedAt < 4_000 ? 1_000 : 2_000
    await new Promise((resolve) => setTimeout(resolve, delay))
    if (!pageActive) break
    current = await $fetch<MemberRegistrationCommandResponse>(
      `/api/member/registration/commands/${command.requestId}`,
    )
  }

  return current
}

async function runAction(session: MemberRegistrationSession, action: RegistrationAction) {
  if (pendingSessions.value[session.sessionKey]) return

  pendingSessions.value = { ...pendingSessions.value, [session.sessionKey]: true }
  actionMessage.value = ''
  actionError.value = ''

  try {
    const command = await $fetch<MemberRegistrationCommandResponse>(
      '/api/member/registration/commands',
      {
        method: 'POST',
        body: { action, sessionKey: session.sessionKey },
      },
    )
    const result = await waitForCommand(command)

    if (result.status === 'succeeded') {
      actionMessage.value = successMessage(action)
    } else if (result.status === 'rejected') {
      actionError.value = commandErrorMessage(result.code)
    } else {
      actionMessage.value =
        'La demande continue en arrière-plan. Actualise la page dans quelques instants.'
    }

    await refresh()
  } catch {
    actionError.value = 'Le service d’inscription est indisponible. Réessaie dans un instant.'
  } finally {
    pendingSessions.value = { ...pendingSessions.value, [session.sessionKey]: false }
  }
}

onBeforeUnmount(() => {
  pageActive = false
  clearRegistration()
})

usePageSeo({
  title: 'Inscriptions aux entraînements',
  description: 'Espace personnel pour consulter et gérer sa prochaine inscription Wolves Toulouse.',
  path: '/inscriptions',
  noindex: true,
})
</script>

<template>
  <div class="registrations-page">
    <section class="registrations-hero" aria-labelledby="registrations-title">
      <div class="container">
        <p class="eyebrow">Espace membre</p>
        <h1 id="registrations-title" class="display-title">Inscriptions</h1>
        <p>Consulte la dernière annonce d’entraînement et inscris-toi avec ton compte Discord.</p>
      </div>
    </section>

    <section class="section section--compact">
      <div class="container registrations-content">
        <MemberSpaceNavigation v-if="loggedIn" />
        <div v-if="!loggedIn || isUnauthorized" class="registrations-state">
          <p class="eyebrow">Connexion requise</p>
          <h2>Connecte ton compte Discord</h2>
          <p>
            BigBadBot vérifiera ton accès aux annonces avant d’afficher les créneaux disponibles.
          </p>
          <NuxtLink class="button button--primary" to="/auth/discord" external>
            Continuer avec Discord
            <span class="button__arrow" aria-hidden="true">→</span>
          </NuxtLink>
        </div>

        <div v-else-if="isForbidden" class="registrations-state">
          <p class="eyebrow">Accès restreint</p>
          <h2>Rôle Discord requis</h2>
          <p>
            Ton compte n’a pas actuellement accès au salon des annonces d’entraînement. Demande au
            club de vérifier tes rôles Discord.
          </p>
        </div>

        <div v-else-if="error" class="registrations-state" role="alert">
          <p class="eyebrow">Service indisponible</p>
          <h2>Impossible de charger la dernière annonce</h2>
          <p>BigBadBot ne répond pas pour le moment. Aucune inscription n’a été modifiée.</p>
          <button class="button button--primary" type="button" @click="refresh()">Réessayer</button>
        </div>

        <AppLoadingState
          v-else-if="initialLoading"
          label="Chargement des créneaux disponibles…"
          description="BigBadBot vérifie ton accès et les inscriptions à la dernière annonce."
          variant="list"
          :count="4"
        />

        <template v-else-if="loggedIn && registration">
          <AppLoadingStatus
            v-if="status === 'pending'"
            label="Actualisation des places disponibles…"
          />
          <div v-if="actionMessage" class="registrations-feedback" role="status">
            {{ actionMessage }}
          </div>
          <div
            v-if="actionError"
            class="registrations-feedback registrations-feedback--error"
            role="alert"
          >
            {{ actionError }}
          </div>

          <div v-if="!registration.announcement" class="registrations-state">
            <p class="eyebrow">Aucune annonce</p>
            <h2>Pas encore de créneau ouvert</h2>
            <p>La prochaine annonce apparaîtra ici dès sa publication par le club.</p>
          </div>

          <article v-else class="registrations-announcement">
            <header>
              <div>
                <p class="eyebrow">Dernière annonce · {{ registration.announcement.weekLabel }}</p>
                <h2>{{ registration.announcement.title }}</h2>
                <p>
                  Publiée le {{ formatDateTime(registration.announcement.createdAt) }} · Les places
                  sont vérifiées par BigBadBot au moment de chaque demande.
                </p>
                <p>
                  Une inscription faite ici est enregistrée directement par BigBadBot, mais
                  n’apparaît pas comme une réaction personnelle sur le message Discord.
                </p>
              </div>
              <a
                v-if="registration.announcement.discordUrl"
                class="button button--ghost"
                :href="registration.announcement.discordUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir dans Discord
              </a>
            </header>

            <ul class="registrations-sessions" aria-label="Créneaux de la dernière annonce">
              <li v-for="session in registration.announcement.sessions" :key="session.sessionKey">
                <div class="registrations-session__heading">
                  <span class="registrations-session__emoji" aria-hidden="true">{{
                    session.emoji
                  }}</span>
                  <div>
                    <h3>{{ session.label }}</h3>
                    <p v-if="session.details" class="registrations-session__details">
                      {{ session.details }}
                    </p>
                    <p>
                      {{ formatDateTime(session.startsAt) }}
                      <template v-if="session.endsAt"
                        >– {{ formatDateTime(session.endsAt) }}</template
                      >
                    </p>
                  </div>
                </div>

                <div class="registrations-session__status">
                  <strong :class="{ 'registrations-session__full': session.isFull }">
                    {{ remainingLabel(session) }}
                  </strong>
                  <span v-if="session.isRegistered">Tu es inscrit·e</span>
                  <span v-else-if="!session.isEligible">{{ eligibilityLabel(session) }}</span>
                </div>

                <div class="registrations-session__actions">
                  <button
                    v-if="session.isRegistered && session.registrationMethod === 'web'"
                    class="button button--ghost"
                    type="button"
                    :disabled="pendingSessions[session.sessionKey]"
                    @click="runAction(session, 'cancel')"
                  >
                    {{
                      pendingSessions[session.sessionKey]
                        ? 'Traitement…'
                        : 'Annuler mon inscription'
                    }}
                  </button>

                  <a
                    v-else-if="session.isRegistered && discordLink(session)"
                    class="button button--ghost"
                    :href="discordLink(session) || undefined"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Gérer mon inscription dans Discord
                  </a>

                  <p v-else-if="session.isRegistered" class="registrations-session__manual">
                    Cette inscription par réaction doit être gérée directement dans Discord.
                  </p>

                  <button
                    v-else-if="!session.isFull"
                    class="button button--primary"
                    type="button"
                    :disabled="!session.isEligible || pendingSessions[session.sessionKey]"
                    @click="runAction(session, 'register')"
                  >
                    {{ pendingSessions[session.sessionKey] ? 'Inscription…' : 'Je m’inscris' }}
                  </button>

                  <button
                    v-else
                    class="button"
                    :class="session.alertEnabled ? 'button--ghost' : 'button--primary'"
                    type="button"
                    :disabled="!session.isEligible || pendingSessions[session.sessionKey]"
                    @click="
                      runAction(
                        session,
                        session.alertEnabled ? 'unsubscribe_alert' : 'subscribe_alert',
                      )
                    "
                  >
                    <template v-if="pendingSessions[session.sessionKey]">Traitement…</template>
                    <template v-else-if="session.alertEnabled">Désactiver l’alerte</template>
                    <template v-else>M’alerter si une place se libère</template>
                  </button>

                  <button
                    v-if="!session.isRegistered && !session.isFull && session.alertEnabled"
                    class="button button--ghost"
                    type="button"
                    :disabled="pendingSessions[session.sessionKey]"
                    @click="runAction(session, 'unsubscribe_alert')"
                  >
                    Désactiver l’alerte existante
                  </button>

                  <a
                    v-if="session.discordUrl"
                    class="registrations-session__discord"
                    :href="session.discordUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir le créneau sur Discord
                  </a>
                </div>
              </li>
            </ul>

            <aside class="registrations-alert-note" aria-labelledby="mobile-alert-title">
              <h3 id="mobile-alert-title">Et sur téléphone&nbsp;?</h3>
              <p>
                L’alerte est envoyée par message privé Discord&nbsp;: elle fonctionne donc aussi sur
                mobile, même après avoir fermé cette page, si les messages privés et notifications
                Discord sont autorisés. Elle ne réserve pas la place&nbsp;: il faudra confirmer
                l’inscription dès la réception du message.
              </p>
            </aside>
          </article>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.registrations-page {
  min-height: 72dvh;
}

.registrations-hero {
  padding-block: clamp(3.5rem, 8vw, 7rem) clamp(2.5rem, 5vw, 4rem);
  border-bottom: 0.08rem solid var(--line);
  background:
    linear-gradient(120deg, rgb(42 56 144 / 38%), transparent 58%),
    radial-gradient(circle at 88% 20%, rgb(255 132 39 / 14%), transparent 24rem);
}

.registrations-hero p:last-child {
  max-width: 43rem;
  margin-top: 1.4rem;
  color: var(--muted);
  font-size: clamp(1rem, 1.8vw, 1.25rem);
}

.registrations-content {
  display: grid;
  gap: 1rem;
}

.registrations-state,
.registrations-announcement {
  padding: clamp(1.4rem, 4vw, 2.5rem);
  border: 0.08rem solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, rgb(42 56 144 / 18%), transparent 60%), var(--ink-soft);
  box-shadow: 0 1rem 2.5rem rgb(11 18 56 / 18%);
}

.registrations-state h2,
.registrations-announcement h2 {
  margin-top: 0.6rem;
  font-family: var(--display);
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 0.95;
  text-transform: uppercase;
}

.registrations-state > p:not(.eyebrow),
.registrations-announcement header p {
  max-width: 45rem;
  margin-top: 1rem;
  color: var(--muted);
}

.registrations-state .button {
  margin-top: 1.5rem;
}

.registrations-feedback {
  padding: 0.9rem 1.1rem;
  border-left: 0.3rem solid #6ee7a7;
  border-radius: var(--radius-sm);
  background: rgb(110 231 167 / 10%);
}

.registrations-feedback--error {
  border-left-color: var(--orange);
  background: rgb(255 132 39 / 10%);
}

.registrations-announcement > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
}

.registrations-announcement > header .button {
  flex: 0 0 auto;
}

.registrations-sessions {
  display: grid;
  gap: 1rem;
  margin-top: 2rem;
  list-style: none;
}

.registrations-sessions > li {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(10rem, 0.7fr) auto;
  align-items: center;
  gap: 1.25rem;
  padding: clamp(1rem, 3vw, 1.4rem);
  border: 0.08rem solid var(--line);
  border-radius: var(--radius);
  background: rgb(255 255 255 / 4%);
}

.registrations-session__heading {
  display: flex;
  align-items: start;
  gap: 0.85rem;
  min-width: 0;
}

.registrations-session__heading h3 {
  font-size: clamp(1rem, 2vw, 1.2rem);
}

.registrations-session__heading p,
.registrations-session__status span,
.registrations-session__discord,
.registrations-alert-note p {
  color: var(--muted);
  font-size: 0.84rem;
}

.registrations-session__heading .registrations-session__details {
  margin-top: 0.35rem;
  color: var(--paper);
  line-height: 1.5;
  white-space: pre-line;
}

.registrations-session__emoji {
  font-size: 1.5rem;
  line-height: 1;
}

.registrations-session__status {
  display: grid;
  gap: 0.3rem;
}

.registrations-session__full {
  color: var(--orange-soft);
}

.registrations-session__actions {
  display: grid;
  justify-items: stretch;
  gap: 0.65rem;
  min-width: min(100%, 15rem);
}

.registrations-session__actions .button {
  width: 100%;
}

.registrations-session__actions .button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.registrations-session__manual {
  color: var(--muted);
  font-size: 0.84rem;
  text-align: center;
}

.registrations-session__discord {
  text-align: center;
}

.registrations-alert-note {
  margin-top: 1.5rem;
  padding: 1rem 1.15rem;
  border-left: 0.3rem solid var(--orange);
  border-radius: var(--radius-sm);
  background: rgb(255 132 39 / 8%);
}

.registrations-alert-note p {
  margin-top: 0.35rem;
  line-height: 1.6;
}

@media (max-width: 64rem) {
  .registrations-sessions > li {
    grid-template-columns: minmax(0, 1fr) minmax(12rem, 0.45fr);
  }

  .registrations-session__status {
    grid-column: 1;
  }

  .registrations-session__actions {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
}

@media (max-width: 42rem) {
  .registrations-announcement > header,
  .registrations-sessions > li {
    display: grid;
    grid-template-columns: 1fr;
  }

  .registrations-announcement > header .button,
  .registrations-session__actions {
    width: 100%;
  }

  .registrations-session__actions {
    grid-column: 1;
    grid-row: auto;
  }

  .registrations-page .button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .registrations-page .button {
    transition: none;
  }
}
</style>
