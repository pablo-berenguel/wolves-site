<script setup lang="ts">
import type { TrainingRosterSession } from '#shared/types/training-roster'

const props = defineProps<{
  sessions: TrainingRosterSession[]
  activeSessionKey?: string | null
  loading: boolean
}>()
const emit = defineEmits<{ select: [key: string] }>()
const componentId = useId()
const dialog = ref<HTMLDialogElement>()
const isOpen = ref(false)
const selectedSession = computed(() =>
  props.sessions.find((session) => session.key === props.activeSessionKey),
)
const compactDayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
})
const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
})
let mobileQuery: MediaQueryList | undefined
let previousBodyOverflow: string | undefined

function formatDate(value: string, formatter: Intl.DateTimeFormat, fallback: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : formatter.format(date)
}

function releaseScrollLock() {
  if (previousBodyOverflow === undefined) return
  document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = undefined
}

function handleClose() {
  isOpen.value = false
  releaseScrollLock()
}

function closePicker() {
  if (dialog.value?.open) dialog.value.close()
  handleClose()
}

function openPicker() {
  if (!dialog.value || dialog.value.open || !mobileQuery?.matches) return
  dialog.value.showModal()
  isOpen.value = true
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

async function selectSession(key: string) {
  if (props.loading) return
  const selectedOnMobile = isOpen.value
  emit('select', key)
  closePicker()
  if (!selectedOnMobile) return
  await nextTick()
  document.getElementById('roster-participants')?.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}

function handleViewportChange(event: MediaQueryListEvent) {
  if (!event.matches) closePicker()
}

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 700px)')
  mobileQuery.addEventListener('change', handleViewportChange)
})
onBeforeUnmount(() => {
  mobileQuery?.removeEventListener('change', handleViewportChange)
  closePicker()
})
</script>

<template>
  <aside class="training-session-picker" aria-label="Choix du créneau">
    <div class="training-session-picker__desktop">
      <header class="training-session-picker__heading">
        <h2>Choisir un créneau</h2>
        <p>{{ sessions.length }} créneaux · Heure de Paris</p>
      </header>
      <div class="training-session-picker__list">
        <TrainingSessionOptions
          :sessions="sessions"
          :active-session-key="activeSessionKey"
          :loading="loading"
          @select="selectSession"
        />
      </div>
    </div>

    <button
      class="training-session-picker__trigger"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :aria-controls="`${componentId}-dialog`"
      @click="openPicker"
    >
      <span class="training-session-picker__emoji" aria-hidden="true">
        {{ selectedSession?.emoji || '📅' }}
      </span>
      <span class="training-session-picker__summary">
        <span class="training-session-picker__eyebrow">Créneau sélectionné</span>
        <strong>{{ selectedSession?.label || 'Choisir un créneau' }}</strong>
        <span v-if="selectedSession" class="training-session-picker__date">
          {{ formatDate(selectedSession.startsAt, compactDayFormatter, 'Date à confirmer') }}
          · {{ formatDate(selectedSession.startsAt, timeFormatter, 'Horaire à confirmer') }} –
          {{ formatDate(selectedSession.endsAt, timeFormatter, 'Horaire à confirmer') }}
        </span>
      </span>
      <span class="training-session-picker__change">
        Changer
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>

    <dialog
      :id="`${componentId}-dialog`"
      ref="dialog"
      class="training-session-sheet"
      :aria-labelledby="`${componentId}-title`"
      :aria-describedby="`${componentId}-description`"
      @close="handleClose"
    >
      <span class="training-session-sheet__handle" aria-hidden="true" />
      <header class="training-session-sheet__header">
        <div>
          <h2 :id="`${componentId}-title`">Choisir un créneau</h2>
          <p :id="`${componentId}-description`">
            {{ sessions.length }} créneaux · Tous les horaires à l’heure de Paris
          </p>
        </div>
        <button
          class="training-session-sheet__close"
          type="button"
          aria-label="Fermer le choix du créneau"
          autofocus
          @click="closePicker"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div class="training-session-sheet__options">
        <TrainingSessionOptions
          :sessions="sessions"
          :active-session-key="activeSessionKey"
          :loading="loading"
          @select="selectSession"
        />
      </div>
    </dialog>
  </aside>
</template>

<style scoped>
.training-session-picker {
  position: sticky;
  top: 7rem;
  min-width: 0;
}
.training-session-picker__heading {
  padding: 0 0.3rem 0.8rem;
}
.training-session-picker__heading h2 {
  font-size: 1rem;
  font-weight: 800;
}
.training-session-picker__heading p {
  margin-top: 0.25rem;
  color: var(--muted);
  font-size: 0.78rem;
}
.training-session-picker__list {
  max-height: calc(100dvh - 12rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.training-session-picker__trigger {
  display: none;
}
.training-session-sheet {
  position: fixed;
  inset: auto 0 0;
  width: 100%;
  max-width: 100%;
  max-height: 80dvh;
  margin: 0;
  padding: 0.6rem max(0.75rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom))
    max(0.75rem, env(safe-area-inset-left));
  overflow: hidden;
  border: 0.08rem solid var(--line);
  border-bottom: 0;
  border-radius: 1.5rem 1.5rem 0 0;
  background: var(--ink);
  color: var(--white);
  box-shadow: var(--shadow);
}
.training-session-sheet[open] {
  display: flex;
  flex-direction: column;
}
.training-session-sheet::backdrop {
  background: rgb(4 8 26 / 75%);
  backdrop-filter: blur(0.2rem);
}
.training-session-sheet__handle {
  flex-shrink: 0;
  width: 2.5rem;
  height: 0.25rem;
  margin: 0 auto 0.65rem;
  border-radius: 999px;
  background: var(--silver);
}
.training-session-sheet__header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.25rem 0.3rem 1rem;
}
.training-session-sheet__header h2 {
  font-size: 1.15rem;
  font-weight: 800;
}
.training-session-sheet__header p {
  margin-top: 0.35rem;
  color: var(--muted);
  font-size: 0.75rem;
}
.training-session-sheet__close {
  display: grid;
  flex: 0 0 2.75rem;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 0.08rem solid var(--line);
  border-radius: 50%;
  background: var(--ink-raised);
  color: var(--white);
  cursor: pointer;
}
.training-session-sheet__close svg {
  width: 1.25rem;
  height: 1.25rem;
}
.training-session-sheet__options {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
@media (min-width: 701px) and (max-width: 900px) {
  .training-session-picker {
    position: static;
  }
  .training-session-picker__list {
    max-height: 19rem;
  }
}
@media (max-width: 700px) {
  .training-session-picker {
    z-index: 20;
    top: 6rem;
    padding-block: 0.5rem;
    background: var(--ink);
  }
  .training-session-picker__desktop {
    display: none;
  }
  .training-session-picker__trigger {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    min-height: 4.8rem;
    padding: 0.75rem;
    border: 0.08rem solid rgb(255 132 39 / 50%);
    border-radius: var(--radius-lg);
    background: var(--ink-soft);
    color: var(--white);
    text-align: left;
    cursor: pointer;
  }
  .training-session-picker__emoji {
    flex: 0 0 1.5rem;
    max-width: 1.5rem;
    overflow-wrap: anywhere;
    font-size: 1.3rem;
  }
  .training-session-picker__summary {
    display: grid;
    flex: 1;
    min-width: 0;
    gap: 0.1rem;
  }
  .training-session-picker__eyebrow {
    color: var(--orange);
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .training-session-picker__summary strong {
    overflow: hidden;
    font-size: 0.85rem;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .training-session-picker__date {
    color: #c3c7d7;
    font-size: 0.7rem;
  }
  .training-session-picker__change {
    display: grid;
    flex-shrink: 0;
    justify-items: center;
    gap: 0.15rem;
    color: var(--orange);
    font-size: 0.7rem;
    font-weight: 800;
  }
  .training-session-picker__change svg {
    width: 1rem;
    height: 1rem;
  }
}
</style>
