<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    description?: string
    variant?: 'cards' | 'list' | 'detail'
    count?: number
  }>(),
  { description: undefined, variant: 'list', count: 3 },
)
</script>

<template>
  <div class="loading-state" :class="`loading-state--${variant}`">
    <AppLoadingStatus :label="label" :description="description" />
    <div class="loading-state__shapes" aria-hidden="true">
      <div v-for="item in count" :key="item" class="loading-state__card">
        <span class="loading-state__badge" />
        <div class="loading-state__lines">
          <span class="loading-state__line loading-state__line--title" />
          <span class="loading-state__line" />
          <span class="loading-state__line loading-state__line--short" />
        </div>
        <span v-if="variant !== 'list'" class="loading-state__metric" />
      </div>
      <div v-if="variant === 'detail'" class="loading-state__panel">
        <span class="loading-state__line loading-state__line--title" />
        <div class="loading-state__chart">
          <span v-for="month in 12" :key="month" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-state {
  display: grid;
  min-width: 0;
  gap: 1.25rem;
}

.loading-state__shapes {
  display: grid;
  min-width: 0;
  gap: 1rem;
  animation: loading-breathe 1.8s ease-in-out infinite alternate;
}

.loading-state--cards .loading-state__shapes {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
}

.loading-state--detail .loading-state__shapes {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
}

.loading-state__card,
.loading-state__panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  min-width: 0;
  padding: clamp(1rem, 2vw, 1.5rem);
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, currentColor 3%, transparent);
}

.loading-state__badge,
.loading-state__line,
.loading-state__metric,
.loading-state__chart span {
  display: block;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.loading-state__badge {
  flex: 0 0 2.6rem;
  height: 2.6rem;
  border-radius: var(--radius);
}

.loading-state__lines {
  display: grid;
  flex: 1 1 7rem;
  min-width: 0;
  gap: 0.65rem;
}

.loading-state__line {
  width: 90%;
  height: 0.65rem;
}

.loading-state__line--title {
  width: 62%;
  height: 1rem;
}

.loading-state__line--short {
  width: 42%;
}

.loading-state__metric {
  width: 100%;
  height: 5rem;
  margin-top: 0.5rem;
}

.loading-state--cards .loading-state__card {
  min-height: 17rem;
}

.loading-state__panel {
  grid-column: 1 / -1;
}

.loading-state__chart {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.6rem;
  width: 100%;
  height: 9rem;
}

@keyframes loading-breathe {
  to {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-state__shapes {
    animation: none;
  }
}
</style>
