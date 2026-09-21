<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsBackgroundStyle, cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'feature_card'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading v-if="block.data.heading" :heading="block.data.heading" />
      <article class="news-card">
        <div
          v-if="block.data.image"
          class="news-card__media"
          :style="cmsBackgroundStyle(block.data.image)"
          :role="block.data.image.decorative ? undefined : 'img'"
          :aria-hidden="block.data.image.decorative ? 'true' : undefined"
          :aria-label="block.data.image.decorative ? undefined : block.data.image.alt"
        />
        <div class="news-card__content">
          <p v-if="block.data.eyebrow" class="eyebrow">{{ block.data.eyebrow }}</p>
          <h3>{{ block.data.title }}</h3>
          <p v-if="block.data.description">{{ block.data.description }}</p>
          <p v-for="paragraph in block.data.paragraphs" :key="paragraph">{{ paragraph }}</p>
          <div v-if="block.data.actions?.length" class="button-group">
            <CmsActionLink
              v-for="action in block.data.actions"
              :key="action.href"
              :action="action"
            />
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
