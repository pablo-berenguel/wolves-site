<script setup lang="ts">
import type { FaqItem } from '~/data/site'

withDefaults(
  defineProps<{
    items: FaqItem[]
    openFirst?: boolean
  }>(),
  {
    openFirst: false,
  },
)
</script>

<template>
  <div class="faq-list">
    <details
      v-for="(item, index) in items"
      :key="item.question"
      class="faq-item"
      :open="openFirst && index === 0"
    >
      <summary>{{ item.question }}</summary>
      <div class="faq-item__answer">
        <p>{{ item.answer }}</p>
      </div>
    </details>
  </div>
</template>
