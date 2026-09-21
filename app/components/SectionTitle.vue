<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
    headingId?: string
  }>(),
  {
    eyebrow: undefined,
    description: undefined,
    headingId: undefined,
  },
)
</script>

<template>
  <header class="section-heading">
    <div>
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h2 :id="headingId" class="section-heading__title">{{ title }}</h2>
    </div>
    <p v-if="description" class="section-heading__text">{{ description }}</p>
  </header>
</template>
