<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
  }
}>()

useSeoMeta({
  title: () => `Erreur ${props.error.statusCode || 404} · Wolves Toulouse`,
  description: 'La page demandée est introuvable sur le site des Wolves Toulouse.',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <NuxtLayout>
    <section class="error-page">
      <p class="eyebrow">Erreur {{ error.statusCode || 404 }}</p>
      <h1>Cette piste ne mène nulle part.</h1>
      <p>La page a peut-être changé de tanière. Retourne à l’accueil pour retrouver la meute.</p>
      <NuxtLink class="button button--primary" to="/">Revenir à l’accueil</NuxtLink>
    </section>
  </NuxtLayout>
</template>
