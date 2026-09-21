<script setup lang="ts">
import type { CmsAction } from '#shared/cms/types'
import { cmsActionArrow, isInternalCmsLink } from './cmsPresentation'

const props = defineProps<{
  action: CmsAction
}>()

const buttonClass = computed(() => `button button--${props.action.variant || 'primary'}`)
const internal = computed(() => isInternalCmsLink(props.action))
</script>

<template>
  <NuxtLink v-if="internal && !action.newWindow" :class="buttonClass" :to="action.href">
    {{ action.label }}
    <span v-if="cmsActionArrow(action)" class="button__arrow" aria-hidden="true">
      {{ cmsActionArrow(action) }}
    </span>
  </NuxtLink>
  <a
    v-else
    :class="buttonClass"
    :href="action.href"
    :target="action.newWindow ? '_blank' : undefined"
    :rel="action.newWindow ? 'noopener noreferrer' : undefined"
  >
    {{ action.label }}
    <span v-if="cmsActionArrow(action)" class="button__arrow" aria-hidden="true">
      {{ cmsActionArrow(action) }}
    </span>
  </a>
</template>
