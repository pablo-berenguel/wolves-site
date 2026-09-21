<script setup lang="ts">
const { isLoading } = useLoadingIndicator({ throttle: 150 })
</script>

<template>
  <NuxtLoadingIndicator
    color="linear-gradient(to right, var(--orange), var(--orange-soft))"
    :height="3"
    :throttle="150"
    aria-hidden="true"
  />
  <div class="navigation-loading" role="status" aria-live="polite" aria-atomic="true">
    <span v-if="isLoading" class="navigation-loading__label">Chargement de la page…</span>
  </div>
</template>

<style scoped>
.navigation-loading {
  position: fixed;
  z-index: 1000;
  right: 1rem;
  bottom: 1rem;
  max-width: calc(100% - 2rem);
  pointer-events: none;
}

.navigation-loading__label {
  display: block;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--orange);
  border-radius: var(--radius);
  color: var(--paper);
  background: var(--ink);
  font-size: 0.8rem;
  font-weight: 700;
  box-shadow: var(--shadow);
}
</style>
