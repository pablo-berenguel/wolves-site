<script setup lang="ts">
import type { Team } from '~/data/site'

defineProps<{
  team: Team
}>()
</script>

<template>
  <article :id="`equipe-${team.slug}`" class="team-card" :style="{ '--team-accent': team.accent }">
    <img
      class="team-card__image"
      :src="team.image"
      :alt="team.imageAlt"
      :width="team.imageWidth || 800"
      :height="team.imageHeight || 1132"
      :style="{ objectPosition: team.imagePosition || '50% 50%' }"
      loading="lazy"
      decoding="async"
    />
    <div class="team-card__content">
      <p class="team-card__level">{{ team.level }}</p>
      <h3 class="team-card__name">{{ team.name }}</h3>
      <p class="team-card__meta">{{ team.division }} · {{ team.program }}</p>
      <p class="team-card__description">{{ team.description }}</p>
    </div>
  </article>
</template>
