<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'palmares_timeline'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading :heading="block.data" />
      <div class="stack">
        <section
          v-for="season in block.data.seasons"
          :key="season.season"
          class="staff-group"
          :aria-labelledby="`${block.id}-${season.season}`"
        >
          <h3 :id="`${block.id}-${season.season}`">Saison {{ season.season }}</h3>
          <ul class="timeline">
            <li
              v-for="highlight in season.highlights"
              :key="`${season.season}-${highlight.competition}`"
              class="timeline__item"
            >
              <p class="timeline__season">{{ highlight.date || season.season }}</p>
              <h4 class="timeline__title">{{ highlight.competition }}</h4>
              <ul class="timeline__results">
                <li v-for="result in highlight.results" :key="result">{{ result }}</li>
              </ul>
            </li>
          </ul>
        </section>
      </div>
      <div v-if="block.data.action" class="button-group mt-lg">
        <CmsActionLink :action="block.data.action" />
      </div>
    </div>
  </section>
</template>
