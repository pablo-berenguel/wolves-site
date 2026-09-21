<script setup lang="ts">
import type { CmsBlockOfType } from '#shared/cms/types'

defineProps<{
  block: CmsBlockOfType<'value_ticker'>
}>()
</script>

<template>
  <div
    :id="block.anchor"
    class="values-band"
    role="region"
    :aria-label="block.data.label || 'Valeurs'"
  >
    <div class="values-marquee">
      <ul class="values-list">
        <li v-for="value in block.data.values" :key="value.title">{{ value.title }}</li>
      </ul>
      <ul class="values-list" aria-hidden="true">
        <li v-for="value in block.data.values" :key="`copy-${value.title}`">
          {{ value.title }}
        </li>
      </ul>
    </div>
  </div>
</template>
