<script setup lang="ts">
defineProps<{
  title: string
  description: string
  years: number[]
  year: number | null
  currentYear: number | null
  pending: boolean
  updatedAt?: string | null
  detail?: boolean
}>()

const emit = defineEmits<{ yearChange: [year: number] }>()
const formatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : formatter.format(date)
}

function changeYear(event: Event) {
  const year = Number((event.target as HTMLSelectElement).value)
  if (Number.isInteger(year)) emit('yearChange', year)
}
</script>

<template>
  <div class="team-statistics">
    <NuxtLink
      v-if="detail"
      class="team-statistics__back"
      :to="{ path: '/admin/statistiques', query: year ? { year } : {} }"
    >
      <span aria-hidden="true">←</span> Toutes les équipes
    </NuxtLink>

    <header class="team-statistics__header">
      <div>
        <p class="team-statistics__eyebrow">Suivi des inscriptions · BigBadBot</p>
        <h1>{{ title }}</h1>
        <p class="team-statistics__intro">{{ description }}</p>
      </div>
      <div class="team-statistics__year">
        <label for="statistics-year">Année civile</label>
        <select
          id="statistics-year"
          :value="year ?? ''"
          :disabled="pending || !years.length"
          @change="changeYear"
        >
          <option v-if="!years.length" value="">
            {{ pending ? 'Chargement…' : 'Années indisponibles' }}
          </option>
          <option v-for="option in years" :key="option" :value="option">
            {{ option }}{{ option === currentYear ? ' · année actuelle' : '' }}
          </option>
        </select>
        <span>Du 1er janvier au 31 décembre · Paris</span>
      </div>
    </header>

    <aside class="team-statistics__notice" aria-label="Comment lire ces statistiques">
      <span class="team-statistics__notice-icon" aria-hidden="true">i</span>
      <div>
        <strong>Des inscriptions, pas des présences confirmées.</strong>
        <p>
          Les équipes correspondent aux rôles Discord actuels, sans les rôles « Rentrée ». Les
          chiffres d’une année passée portent sur cet effectif actuel : ils ne reconstituent pas
          l’équipe de l’époque. L’historique conservé par BigBadBot peut être partiel.
        </p>
      </div>
    </aside>

    <div class="team-statistics__content">
      <slot />
    </div>

    <p v-if="updatedAt && formatUpdatedAt(updatedAt)" class="team-statistics__updated">
      Dernière mise à jour des données : {{ formatUpdatedAt(updatedAt) }} (Paris).
    </p>
  </div>
</template>

<style scoped>
.team-statistics {
  --stats-muted: #596582;
  --stats-border: #dfe3f0;
  display: grid;
  min-width: 0;
  gap: 1.5rem;
  color: var(--ink);
}

.team-statistics__back {
  justify-self: start;
  color: var(--indigo);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}

.team-statistics__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.team-statistics__header > div:first-child {
  flex: 1 1 23rem;
}

.team-statistics__eyebrow {
  margin-bottom: 0.65rem;
  color: var(--indigo);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.team-statistics h1 {
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  font-weight: 800;
  line-height: 1.15;
}

.team-statistics__intro {
  max-width: 45rem;
  margin-top: 0.7rem;
  color: var(--stats-muted);
}

.team-statistics__year {
  display: grid;
  flex: 0 1 18rem;
  min-width: 0;
  gap: 0.4rem;
}

.team-statistics__year label {
  font-size: 0.85rem;
  font-weight: 800;
}

.team-statistics__year select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 2rem 0.65rem 0.8rem;
  border: 1px solid var(--stats-border);
  border-radius: var(--radius);
  color: var(--ink);
  background: white;
  font: inherit;
  font-weight: 700;
}

.team-statistics__year span,
.team-statistics__updated {
  color: var(--stats-muted);
  font-size: 0.75rem;
}

.team-statistics__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem 1.15rem;
  border: 1px solid #d7def6;
  border-radius: var(--radius-lg);
  background: #edf0fc;
  font-size: 0.85rem;
}

.team-statistics__notice-icon {
  display: grid;
  flex: 0 0 1.4rem;
  height: 1.4rem;
  place-items: center;
  border: 1px solid var(--indigo);
  border-radius: 50%;
  color: var(--indigo);
  font-weight: 800;
}

.team-statistics__notice p {
  margin-top: 0.3rem;
  color: var(--stats-muted);
  line-height: 1.6;
}

.team-statistics__content {
  display: grid;
  min-width: 0;
  gap: 1.25rem;
}

@media (max-width: 500px) {
  .team-statistics__year {
    flex-basis: 100%;
  }
}
</style>
