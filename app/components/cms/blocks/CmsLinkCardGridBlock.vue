<script setup lang="ts">
import type { CmsBlockOfType, CmsImage } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'link_card_grid'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme, true))

function pathCardStyle(image: CmsImage | undefined) {
  if (!image) return undefined

  return {
    '--path-card-image': `url("${image.src.replaceAll('"', '%22')}")`,
    '--path-card-position': `${image.focalX ?? 50}% ${image.focalY ?? 50}%`,
  }
}
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading :heading="block.data" />
      <div class="path-grid">
        <NuxtLink
          v-for="card in block.data.cards"
          :key="`${card.href}-${card.title}`"
          class="path-card"
          :class="
            !card.image && card.variant && card.variant !== 'default'
              ? `path-card--${card.variant}`
              : undefined
          "
          :style="pathCardStyle(card.image)"
          :to="card.href"
        >
          <span v-if="card.index" class="path-card__number">{{ card.index }}</span>
          <h3>{{ card.title }}</h3>
          <p>{{ card.content }}</p>
          <span class="path-card__link">
            {{ card.linkLabel }} <span aria-hidden="true">→</span>
          </span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
