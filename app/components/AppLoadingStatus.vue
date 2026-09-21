<script setup lang="ts">
defineProps<{ label: string; description?: string }>()

const takingLonger = ref(false)
let patienceTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  patienceTimer = setTimeout(() => {
    takingLonger.value = true
  }, 8_000)
})
onBeforeUnmount(() => clearTimeout(patienceTimer))
</script>

<template>
  <div class="loading-status" role="status" aria-live="polite" aria-atomic="true">
    <span class="loading-status__spinner" aria-hidden="true" />
    <div>
      <p class="loading-status__label">{{ label }}</p>
      <p v-if="description" class="loading-status__description">{{ description }}</p>
      <p v-if="takingLonger" class="loading-status__description">
        Cela prend un peu plus de temps. Tu peux laisser cette page ouverte ou revenir plus tard.
      </p>
    </div>
  </div>
</template>

<style scoped>
.loading-status {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  min-width: 0;
  font-size: 0.85rem;
}

.loading-status__spinner {
  flex: 0 0 1.1rem;
  width: 1.1rem;
  height: 1.1rem;
  margin-top: 0.15rem;
  border: 2px solid color-mix(in srgb, currentColor 20%, transparent);
  border-top-color: var(--loading-accent, var(--orange));
  border-radius: 50%;
  animation: loading-turn 0.9s linear infinite;
}

.loading-status__label {
  font-weight: 700;
}

.loading-status__description {
  margin-top: 0.3rem;
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

@keyframes loading-turn {
  to {
    transform: rotate(1turn);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-status__spinner {
    animation: none;
  }
}
</style>
