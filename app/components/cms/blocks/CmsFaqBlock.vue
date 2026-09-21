<script setup lang="ts">
import type { FaqItem } from '~/data/site'
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'faq'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
const items = computed<FaqItem[]>(() =>
  props.block.data.items.map((item) => ({
    question: item.question,
    answer: item.answer,
    category: item.category || 'Club',
  })),
)
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading :heading="block.data" />
      <FaqList :items="items" :open-first="block.data.openFirst" />
    </div>
  </section>
</template>
