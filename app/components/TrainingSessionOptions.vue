<script setup lang="ts">
import type { TrainingRosterSession } from '#shared/types/training-roster'

defineProps<{
  sessions: TrainingRosterSession[]
  activeSessionKey?: string | null
  loading: boolean
}>()

const emit = defineEmits<{ select: [key: string] }>()
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
const stateLabels = { past: 'Terminé', ongoing: 'En cours', upcoming: 'À venir' }

function formatDate(value: string, formatter: Intl.DateTimeFormat, fallback: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : formatter.format(date)
}
</script>

<template>
  <ul class="training-session-options">
    <li v-for="session in sessions" :key="session.key">
      <button
        class="training-session-option"
        type="button"
        :aria-pressed="session.key === activeSessionKey"
        :aria-disabled="loading"
        aria-controls="roster-participants"
        @click="!loading && emit('select', session.key)"
      >
        <span class="training-session-option__emoji" aria-hidden="true">{{ session.emoji }}</span>
        <span class="training-session-option__content">
          <strong>{{ session.label }}</strong>
          <span>{{ formatDate(session.startsAt, dayFormatter, 'Date à confirmer') }}</span>
          <span>
            {{ formatDate(session.startsAt, timeFormatter, 'Horaire à confirmer') }} –
            {{ formatDate(session.endsAt, timeFormatter, 'Horaire à confirmer') }}
          </span>
          <small :class="{ 'is-ongoing': session.state === 'ongoing' }">
            {{ stateLabels[session.state] }}
          </small>
        </span>
        <span class="training-session-option__check" aria-hidden="true">
          <svg
            v-if="session.key === activeSessionKey"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        </span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.training-session-options {
  display: grid;
  gap: 0.65rem;
  padding: 0.3rem;
  list-style: none;
}
.training-session-option {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.95rem;
  border: 0.08rem solid var(--line);
  border-radius: var(--radius-lg);
  color: var(--paper);
  background: var(--ink-soft);
  text-align: left;
  cursor: pointer;
}
.training-session-option[aria-pressed='true'] {
  border-color: var(--orange);
  background: linear-gradient(120deg, rgb(255 132 39 / 12%), transparent), var(--ink-soft);
}
.training-session-option[aria-disabled='true'] {
  cursor: progress;
}
@media (hover: hover) {
  .training-session-option:hover {
    border-color: var(--orange);
  }
}
.training-session-option__emoji {
  flex: 0 0 1.7rem;
  max-width: 1.7rem;
  overflow-wrap: anywhere;
  font-size: 1.4rem;
}
.training-session-option__content {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 0.2rem;
}
.training-session-option__content strong {
  overflow-wrap: anywhere;
  font-size: 0.88rem;
  font-weight: 800;
}
.training-session-option__content > span {
  color: #c3c7d7;
  font-size: 0.78rem;
}
.training-session-option__content small {
  justify-self: start;
  margin-top: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 8%);
  font-size: 0.7rem;
  font-weight: 700;
}
.training-session-option__content small.is-ongoing {
  color: var(--orange-soft);
  background: rgb(255 200 0 / 10%);
}
.training-session-option__check {
  display: grid;
  flex: 0 0 1.25rem;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.1rem;
  border: 0.08rem solid var(--line);
  border-radius: 50%;
}
[aria-pressed='true'] .training-session-option__check {
  border-color: var(--orange);
  background: var(--orange);
  color: var(--ink);
}
.training-session-option__check svg {
  width: 0.9rem;
  height: 0.9rem;
}
</style>
