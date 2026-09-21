<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsBackgroundStyle } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'hero'>
}>()

const data = computed(() => props.block.data)
const isHomeHero = computed(() => props.block.variant === 'home-video')
const homeBackground = computed(() =>
  cmsBackgroundStyle(data.value.video?.poster || data.value.image),
)
</script>

<template>
  <section
    v-if="isHomeHero"
    :id="block.anchor"
    class="home-hero"
    :style="homeBackground"
    :aria-labelledby="`${block.id}-title`"
  >
    <video
      v-if="data.video"
      class="home-hero__video"
      autoplay
      muted
      loop
      playsinline
      preload="metadata"
      :poster="data.video.poster?.src"
      aria-hidden="true"
      disablepictureinpicture
    >
      <source :src="data.video.src" :type="data.video.mimeType || 'video/mp4'" />
    </video>
    <div class="home-hero__noise" aria-hidden="true" />
    <div class="home-hero__content">
      <p v-if="data.eyebrow" class="eyebrow">{{ data.eyebrow }}</p>
      <h1 :id="`${block.id}-title`" class="home-hero__title">
        <template v-if="data.titleLines?.length">
          <span
            v-for="line in data.titleLines"
            :key="`${line.style}-${line.text}`"
            class="home-hero__title-line"
            :class="`home-hero__title-line--${line.style || 'solid'}`"
          >
            {{ line.text }}
          </span>
        </template>
        <span v-else class="home-hero__title-line home-hero__title-line--solid">
          {{ data.title }}
        </span>
      </h1>
      <p v-if="data.description" class="home-hero__copy">{{ data.description }}</p>
      <div v-if="data.actions?.length" class="button-group">
        <CmsActionLink v-for="action in data.actions" :key="action.href" :action="action" />
      </div>
    </div>
    <p v-if="data.aside" class="home-hero__aside">{{ data.aside }}</p>
  </section>

  <PageHero
    v-else
    :id="block.anchor"
    :eyebrow="data.eyebrow"
    :title="data.title"
    :description="data.description"
    :image="data.image?.src"
    :image-alt="data.image?.decorative ? '' : data.image?.alt"
    :image-width="data.image?.width"
    :image-height="data.image?.height"
    :image-position="`${data.image?.focalX ?? 50}% ${data.image?.focalY ?? 50}%`"
    :size="data.size || (block.variant === 'compact' ? 'compact' : 'default')"
  >
    <template v-if="data.actions?.length" #actions>
      <div class="button-group">
        <CmsActionLink v-for="action in data.actions" :key="action.href" :action="action" />
      </div>
    </template>
  </PageHero>
</template>
