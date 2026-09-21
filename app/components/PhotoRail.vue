<script setup lang="ts">
import { nextTick, onMounted, ref, useId } from 'vue'

interface Photo {
  src: string
  alt: string
  caption?: string
  width?: number
  height?: number
  position?: string
}

withDefaults(
  defineProps<{
    photos: Photo[]
    label?: string
  }>(),
  {
    label: 'Galerie photos',
  },
)

const viewport = ref<HTMLElement | null>(null)
const railId = `galerie-${useId().replaceAll(':', '')}`
const canPrevious = ref(false)
const canNext = ref(true)

function updateControls() {
  const element = viewport.value
  if (!element) return
  canPrevious.value = element.scrollLeft > 2
  canNext.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 2
}

function scroll(direction: -1 | 1) {
  const element = viewport.value
  if (!element) return
  element.scrollBy({
    left: direction * Math.max(element.clientWidth * 0.8, 280),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}

onMounted(async () => {
  await nextTick()
  updateControls()
})
</script>

<template>
  <section class="photo-rail" :aria-label="label">
    <div
      :id="railId"
      ref="viewport"
      class="photo-rail__viewport"
      tabindex="0"
      @scroll.passive="updateControls"
    >
      <figure v-for="(photo, index) in photos" :key="photo.src" class="photo-rail__item">
        <img
          :src="photo.src"
          :alt="photo.alt"
          :width="photo.width"
          :height="photo.height"
          :style="{ objectPosition: photo.position || '50% 50%' }"
          :loading="index === 0 ? 'eager' : 'lazy'"
          decoding="async"
        />
        <figcaption v-if="photo.caption" class="photo-rail__caption">
          {{ photo.caption }}
        </figcaption>
      </figure>
    </div>

    <div class="photo-rail__controls">
      <button
        class="round-button"
        type="button"
        :disabled="!canPrevious"
        :aria-controls="railId"
        aria-label="Photos précédentes"
        @click="scroll(-1)"
      >
        ←
      </button>
      <button
        class="round-button"
        type="button"
        :disabled="!canNext"
        :aria-controls="railId"
        aria-label="Photos suivantes"
        @click="scroll(1)"
      >
        →
      </button>
    </div>
  </section>
</template>
