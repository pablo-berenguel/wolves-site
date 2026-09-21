<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'season_card'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container join-intro">
      <article class="season-card">
        <p class="season-card__year">{{ block.data.season }}</p>
        <h2>{{ block.data.title }}</h2>
        <p>{{ block.data.content }}</p>
        <p v-if="block.data.note" class="notice">{{ block.data.note }}</p>
        <div v-if="block.data.actions?.length" class="button-group">
          <CmsActionLink v-for="action in block.data.actions" :key="action.href" :action="action" />
        </div>
      </article>
    </div>
  </section>
</template>
