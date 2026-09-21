<script setup lang="ts">
import type { CmsPage } from '#shared/cms/types'
import { sortCmsBlocks } from '#shared/cms/registry'

const props = defineProps<{
  page: CmsPage
}>()

const visibleBlocks = computed(() =>
  sortCmsBlocks(props.page.blocks).filter((block) => block.enabled),
)
</script>

<template>
  <div>
    <CmsBlockRenderer v-for="block in visibleBlocks" :key="block.id" :block="block" />
  </div>
</template>
