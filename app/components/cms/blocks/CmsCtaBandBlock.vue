<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'cta_band'>
}>()

const sectionClass = computed(() =>
  cmsSectionClasses(props.block.theme, props.block.variant !== 'default'),
)
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container cta-band">
      <div>
        <h2>{{ block.data.title }}</h2>
        <p v-if="block.data.content">{{ block.data.content }}</p>
      </div>
      <CmsActionLink v-if="block.data.action" :action="block.data.action" />
    </div>
  </section>
</template>
