<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'comparison_card_grid'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading :heading="block.data" />
      <div class="join-paths">
        <article v-for="card in block.data.cards" :key="card.title" class="join-path">
          <p v-if="card.tag" class="join-path__tag">{{ card.tag }}</p>
          <h3>{{ card.title }}</h3>
          <p>{{ card.content }}</p>
          <ul v-if="card.items?.length">
            <li v-for="item in card.items" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>
    </div>
  </section>
</template>
