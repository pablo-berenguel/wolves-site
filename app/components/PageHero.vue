<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
    image?: string
    imageAlt?: string
    imageWidth?: number
    imageHeight?: number
    imagePosition?: string
    size?: 'compact' | 'default' | 'large'
  }>(),
  {
    eyebrow: undefined,
    description: undefined,
    image: undefined,
    imageAlt: '',
    imageWidth: undefined,
    imageHeight: undefined,
    imagePosition: '50% 50%',
    size: 'default',
  },
)
</script>

<template>
  <section class="page-hero" :class="`page-hero--${size}`">
    <div v-if="image" class="page-hero__media">
      <img
        :src="image"
        :alt="imageAlt"
        :width="imageWidth"
        :height="imageHeight"
        :style="{ objectPosition: imagePosition }"
        fetchpriority="high"
        decoding="async"
      />
    </div>
    <div class="page-hero__overlay" aria-hidden="true" />

    <div class="page-hero__content">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1 class="page-hero__title">{{ title }}</h1>
      <p v-if="description" class="page-hero__description">{{ description }}</p>
      <div v-if="$slots.actions" class="page-hero__actions">
        <slot name="actions" />
      </div>
      <slot />
    </div>
  </section>
</template>
