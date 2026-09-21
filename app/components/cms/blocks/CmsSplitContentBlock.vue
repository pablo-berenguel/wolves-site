<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsImageStyle, cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'split_content'>
}>()

const data = computed(() => props.block.data)
const story = computed(() => props.block.variant === 'story')
const imageFirst = computed(() => data.value.imageSide !== 'right')
const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div v-if="story" class="container about-grid">
      <div v-if="data.image" class="about-media about-media--image">
        <img
          class="about-media__main"
          :src="data.image.src"
          :alt="data.image.decorative ? '' : data.image.alt"
          :width="data.image.width"
          :height="data.image.height"
          :style="cmsImageStyle(data.image)"
          loading="lazy"
          decoding="async"
        />
        <p v-if="data.badge" class="about-media__badge">{{ data.badge }}</p>
      </div>
      <div class="about-content">
        <p v-if="data.eyebrow" class="eyebrow">{{ data.eyebrow }}</p>
        <h2>{{ data.title }}</h2>
        <p v-if="data.description">{{ data.description }}</p>
        <p v-for="paragraph in data.paragraphs" :key="paragraph">{{ paragraph }}</p>
        <blockquote v-if="data.quote" class="pullquote">{{ data.quote }}</blockquote>
        <ul v-if="data.listItems?.length" :aria-label="data.listLabel">
          <li v-for="item in data.listItems" :key="item">{{ item }}</li>
        </ul>
        <div v-if="data.stats?.length" class="stats-grid">
          <div v-for="stat in data.stats" :key="`${stat.value}-${stat.label}`" class="stat">
            <p class="stat__number">{{ stat.value }}</p>
            <p class="stat__label">{{ stat.label }}</p>
          </div>
        </div>
        <div v-if="data.actions?.length" class="button-group">
          <CmsActionLink v-for="action in data.actions" :key="action.href" :action="action" />
        </div>
      </div>
    </div>

    <div v-else class="container content-grid">
      <figure v-if="data.image && imageFirst" class="image-frame">
        <img
          :src="data.image.src"
          :alt="data.image.decorative ? '' : data.image.alt"
          :width="data.image.width"
          :height="data.image.height"
          :style="cmsImageStyle(data.image)"
          loading="lazy"
          decoding="async"
        />
      </figure>
      <div class="prose">
        <p v-if="data.eyebrow" class="eyebrow">{{ data.eyebrow }}</p>
        <h2>{{ data.title }}</h2>
        <p v-if="data.description">{{ data.description }}</p>
        <p v-for="paragraph in data.paragraphs" :key="paragraph">{{ paragraph }}</p>
        <blockquote v-if="data.quote" class="pullquote">{{ data.quote }}</blockquote>
        <ul v-if="data.listItems?.length" class="event-types" :aria-label="data.listLabel">
          <li v-for="item in data.listItems" :key="item">{{ item }}</li>
        </ul>
        <div v-if="data.stats?.length" class="stats-grid">
          <div v-for="stat in data.stats" :key="`${stat.value}-${stat.label}`" class="stat">
            <p class="stat__number">{{ stat.value }}</p>
            <p class="stat__label">{{ stat.label }}</p>
          </div>
        </div>
        <div v-if="data.actions?.length" class="button-group">
          <CmsActionLink v-for="action in data.actions" :key="action.href" :action="action" />
        </div>
      </div>
      <figure v-if="data.image && !imageFirst" class="image-frame">
        <img
          :src="data.image.src"
          :alt="data.image.decorative ? '' : data.image.alt"
          :width="data.image.width"
          :height="data.image.height"
          :style="cmsImageStyle(data.image)"
          loading="lazy"
          decoding="async"
        />
      </figure>
    </div>
  </section>
</template>
