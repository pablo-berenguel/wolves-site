<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'
import { cmsSectionClasses } from '../cmsPresentation'

const props = defineProps<{
  block: CmsBlockOfType<'photo_rail'>
}>()

const sectionClass = computed(() => cmsSectionClasses(props.block.theme))
const photos = computed(() =>
  props.block.data.photos.map((photo) => ({
    src: photo.image.src,
    alt: photo.image.decorative ? '' : photo.image.alt,
    width: photo.image.width,
    height: photo.image.height,
    position: `${photo.image.focalX ?? 50}% ${photo.image.focalY ?? 50}%`,
    caption: photo.caption,
  })),
)
</script>

<template>
  <section :id="block.anchor" :class="sectionClass">
    <div class="container">
      <CmsSectionHeading :heading="block.data" />
    </div>
    <PhotoRail :photos="photos" :label="block.data.label" />
  </section>
</template>
