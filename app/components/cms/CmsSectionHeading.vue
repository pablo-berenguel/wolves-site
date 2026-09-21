<script setup lang="ts">
import type { CmsSectionHeading } from '#shared/cms/types'

defineProps<{
  heading: CmsSectionHeading
  headingId?: string
}>()
</script>

<template>
  <header class="section-heading">
    <div>
      <p v-if="heading.eyebrow" class="eyebrow">{{ heading.eyebrow }}</p>
      <h2 :id="headingId" class="section-heading__title">{{ heading.title }}</h2>
    </div>
    <p v-if="heading.description" class="section-heading__text">{{ heading.description }}</p>
  </header>
</template>
