<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'indexed_card_grid'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
const gridClass = computed(() =>
  props.block.variant === 'disciplines' ? 'discipline-grid' : 'cards-grid',
)

function displayIndex(index: string | undefined, position: number) {
  return index || String(position + 1).padStart(2, '0')
}
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading :heading="block.data" />
      <div :class="gridClass">
        <article
          v-for="(card, index) in block.data.cards"
          :key="`${card.title}-${index}`"
          :class="block.variant === 'disciplines' ? 'discipline' : 'simple-card'"
        >
          <p :class="block.variant === 'disciplines' ? 'discipline__number' : 'simple-card__index'">
            {{ displayIndex(card.index, index) }}
          </p>
          <h3>{{ card.title }}</h3>
          <p>{{ card.content }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
